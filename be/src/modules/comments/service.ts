import { db } from '@/db';
import { comments, commentLikes, contents, creators, users } from '@/db/schema';
import { eq, desc, and, sql, isNull, inArray } from 'drizzle-orm';
import { notifyNewComment } from '@/modules/notifications/service';
import type { CreateCommentInput, UpdateCommentInput } from './schemas';

export async function createComment(contentId: string, userId: string, input: CreateCommentInput) {
  // Verificar se o conteúdo existe
  const content = await db.query.contents.findFirst({ where: eq(contents.id, contentId) });
  if (!content) throw new Error('Conteúdo não encontrado');

  // Verificar se é resposta a um comentário existente
  if (input.parentId) {
    const parent = await db.query.comments.findFirst({ where: eq(comments.id, input.parentId) });
    if (!parent || parent.contentId !== contentId) {
      throw new Error('Comentário pai não encontrado');
    }
  }

  const [comment] = await db
    .insert(comments)
    .values({
      contentId,
      userId,
      text: input.text,
      parentId: input.parentId,
    })
    .returning();

  // Notificar o dono do conteúdo
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, content.creatorId) });
  if (creator) {
    await notifyNewComment(creator.userId, userId, contentId);
  }

  return comment;
}

export async function getCommentById(commentId: string) {
  return db.query.comments.findFirst({ where: eq(comments.id, commentId) });
}

export async function listComments(contentId: string, page = 1, pageSize = 20, userId?: string) {
  const offset = (page - 1) * pageSize;

  // Buscar apenas comentários de primeiro nível (não respostas)
  const commentList = await db
    .select({
      id: comments.id,
      text: comments.text,
      likeCount: comments.likeCount,
      isDeleted: comments.isDeleted,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      parentId: comments.parentId,
      userId: comments.userId,
      // User info
      userName: users.name,
      userUsername: users.username,
      userAvatarUrl: users.avatarUrl,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(and(
      eq(comments.contentId, contentId),
      eq(comments.isDeleted, false),
      isNull(comments.parentId)
    ))
    .orderBy(desc(comments.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Contar total
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(
      eq(comments.contentId, contentId),
      eq(comments.isDeleted, false),
      isNull(comments.parentId)
    ));

  // Buscar likes do usuário
  let userLikes: Set<string> = new Set();
  if (userId) {
    const likes = await db
      .select({ commentId: commentLikes.commentId })
      .from(commentLikes)
      .where(eq(commentLikes.userId, userId));
    userLikes = new Set(likes.map(l => l.commentId));
  }

  // Buscar respostas para cada comentário
  const commentIds = commentList.map(c => c.id);
  let replies: typeof commentList = [];

  if (commentIds.length > 0) {
    replies = await db
      .select({
        id: comments.id,
        text: comments.text,
        likeCount: comments.likeCount,
        isDeleted: comments.isDeleted,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        parentId: comments.parentId,
        userId: comments.userId,
        userName: users.name,
        userUsername: users.username,
        userAvatarUrl: users.avatarUrl,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(and(
        eq(comments.contentId, contentId),
        eq(comments.isDeleted, false),
        inArray(comments.parentId, commentIds)
      ))
      .orderBy(comments.createdAt);
  }

  const repliesByParent = new Map<string, typeof replies>();
  for (const reply of replies) {
    if (!reply.parentId) continue;
    if (!repliesByParent.has(reply.parentId)) {
      repliesByParent.set(reply.parentId, []);
    }
    repliesByParent.get(reply.parentId)!.push(reply);
  }

  const processedComments = commentList.map(c => ({
    id: c.id,
    text: c.text,
    likeCount: c.likeCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    hasLiked: userLikes.has(c.id),
    user: {
      id: c.userId,
      name: c.userName,
      username: c.userUsername,
      avatarUrl: c.userAvatarUrl,
    },
    replies: (repliesByParent.get(c.id) || []).map(r => ({
      id: r.id,
      text: r.text,
      likeCount: r.likeCount,
      createdAt: r.createdAt,
      hasLiked: userLikes.has(r.id),
      user: {
        id: r.userId,
        name: r.userName,
        username: r.userUsername,
        avatarUrl: r.userAvatarUrl,
      },
    })),
  }));

  return {
    data: processedComments,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function updateComment(commentId: string, userId: string, input: UpdateCommentInput) {
  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.userId, userId)),
  });

  if (!comment) throw new Error('Comentário não encontrado');

  const [updated] = await db
    .update(comments)
    .set({ text: input.text, updatedAt: new Date() })
    .where(eq(comments.id, commentId))
    .returning();

  return updated;
}

export async function deleteComment(commentId: string, userId: string) {
  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.userId, userId)),
  });

  if (!comment) throw new Error('Comentário não encontrado');

  // Soft delete
  await db
    .update(comments)
    .set({ isDeleted: true, text: '[Comentário removido]', updatedAt: new Date() })
    .where(eq(comments.id, commentId));
}

export async function likeComment(commentId: string, userId: string) {
  const existing = await db.query.commentLikes.findFirst({
    where: and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)),
  });

  if (existing) {
    await db.delete(commentLikes).where(eq(commentLikes.id, existing.id));
    await db.update(comments).set({ likeCount: sql`${comments.likeCount} - 1` }).where(eq(comments.id, commentId));
    return { liked: false };
  }

  await db.insert(commentLikes).values({ commentId, userId });
  await db.update(comments).set({ likeCount: sql`${comments.likeCount} + 1` }).where(eq(comments.id, commentId));
  return { liked: true };
}
