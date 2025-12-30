import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { uploadFile, deleteFile } from '@/lib/storage';
import type { UpdateProfileInput } from './schemas';

export async function getUserById(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      username: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  return user;
}

export async function getUserByUsername(username: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username.toLowerCase()),
    columns: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // Verificar se username já existe (se fornecido)
  if (input.username) {
    const existingUser = await db.query.users.findFirst({
      where: and(
        eq(users.username, input.username.toLowerCase()),
        ne(users.id, userId)
      ),
    });

    if (existingUser) {
      throw new Error('Este username já está em uso');
    }
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      ...input,
      username: input.username?.toLowerCase(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
      role: users.role,
      emailVerified: users.emailVerified,
    });

  return updatedUser;
}

export async function updateAvatar(userId: string, file: File) {
  // Buscar usuário atual para deletar avatar antigo
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Upload novo avatar
  const result = await uploadFile(file, 'avatar', userId);

  // Deletar avatar antigo se existir
  if (user.avatarUrl) {
    const oldPath = user.avatarUrl.split('/uploads/')[1];
    if (oldPath) {
      await deleteFile(oldPath);
    }
  }

  // Atualizar URL no banco
  const [updatedUser] = await db
    .update(users)
    .set({
      avatarUrl: result.url,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      avatarUrl: users.avatarUrl,
    });

  return updatedUser;
}

export async function deleteAvatar(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.avatarUrl) {
    return;
  }

  // Deletar arquivo
  const path = user.avatarUrl.split('/uploads/')[1];
  if (path) {
    await deleteFile(path);
  }

  // Atualizar banco
  await db
    .update(users)
    .set({
      avatarUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function checkUsernameAvailability(username: string, excludeUserId?: string) {
  const existingUser = await db.query.users.findFirst({
    where: excludeUserId
      ? and(eq(users.username, username.toLowerCase()), ne(users.id, excludeUserId))
      : eq(users.username, username.toLowerCase()),
  });

  return !existingUser;
}

export async function updateBanner(userId: string, file: File) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Upload new banner
  const result = await uploadFile(file, 'image', userId);

  // Delete old banner if exists
  if (user.bannerUrl) {
    const oldPath = user.bannerUrl.split('/uploads/')[1];
    if (oldPath) {
      await deleteFile(oldPath);
    }
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      bannerUrl: result.url,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      bannerUrl: users.bannerUrl,
    });

  return updatedUser;
}
