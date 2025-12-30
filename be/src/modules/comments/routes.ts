import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth } from '@/middlewares/auth';
import { createCommentSchema, updateCommentSchema, listCommentsSchema } from './schemas';
import * as commentService from './service';

const commentRoutes = new Hono<{ Variables: AppVariables }>();

// GET /api/comments/:contentId - Listar comentários de um conteúdo
commentRoutes.get('/:contentId', zValidator('query', listCommentsSchema), async (c) => {
  const contentId = c.req.param('contentId');
  const input = c.req.valid('query');
  const user = c.get('user');

  const result = await commentService.listComments(contentId, input.page, input.pageSize, user?.id);
  return c.json(result);
});

// POST /api/comments/:contentId - Criar comentário
commentRoutes.post('/:contentId', requireAuth, zValidator('json', createCommentSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const contentId = c.req.param('contentId');
    const input = c.req.valid('json');

    const comment = await commentService.createComment(contentId, user.id, input);
    return c.json({ message: 'Comentário criado!', comment }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// PUT /api/comments/:id - Editar comentário
commentRoutes.put('/:id', requireAuth, zValidator('json', updateCommentSchema), async (c) => {
  try {
    const user = c.get('user')!;
    const commentId = c.req.param('id');
    const input = c.req.valid('json');

    const comment = await commentService.updateComment(commentId, user.id, input);
    return c.json({ comment });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// DELETE /api/comments/:id - Deletar comentário
commentRoutes.delete('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user')!;
    const commentId = c.req.param('id');

    await commentService.deleteComment(commentId, user.id);
    return c.json({ message: 'Comentário removido' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro' }, 400);
  }
});

// POST /api/comments/:id/like - Curtir/descurtir comentário
commentRoutes.post('/:id/like', requireAuth, async (c) => {
  const user = c.get('user')!;
  const commentId = c.req.param('id');

  const result = await commentService.likeComment(commentId, user.id);
  return c.json(result);
});

export { commentRoutes };
