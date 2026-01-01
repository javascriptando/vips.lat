import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { lucia, hashPassword, verifyPassword, generateToken } from '@/lib/auth';
import { sendEmail, emailVerificationTemplate, passwordResetTemplate } from '@/lib/email';
import { env } from '@/config/env';
import { eq, and, gt } from 'drizzle-orm';
import type { RegisterInput, LoginInput } from './schemas';

export async function register(input: RegisterInput) {
  // Verificar se email já existe
  const existingEmail = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  });

  if (existingEmail) {
    throw new Error('Este email já está cadastrado');
  }

  // Verificar se username já existe
  const existingUsername = await db.query.users.findFirst({
    where: eq(users.username, input.username.toLowerCase()),
  });

  if (existingUsername) {
    throw new Error('Este username já está em uso');
  }

  // Hash da senha
  const passwordHash = await hashPassword(input.password);

  // Criar usuário
  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      username: input.username.toLowerCase(),
      passwordHash,
      name: input.name,
    })
    .returning();

  // Criar token de verificação
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  await db.insert(verificationTokens).values({
    userId: user.id,
    token,
    type: 'email_verification',
    expiresAt,
  });

  // Enviar email de verificação
  const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verifique seu email - VIPS',
    html: emailVerificationTemplate(user.name || '', verificationUrl),
  });

  // Criar sessão
  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  return { user, sessionCookie };
}

export async function login(input: LoginInput) {
  // Buscar usuário
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  });

  if (!user) {
    throw new Error('Email ou senha incorretos');
  }

  // Verificar senha
  const validPassword = await verifyPassword(input.password, user.passwordHash);
  if (!validPassword) {
    throw new Error('Email ou senha incorretos');
  }

  // Criar sessão
  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  return { user, sessionCookie };
}

export async function logout(sessionId: string) {
  await lucia.invalidateSession(sessionId);
  return lucia.createBlankSessionCookie();
}

export async function verifyEmail(token: string) {
  // Buscar token
  const verificationToken = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.token, token),
      eq(verificationTokens.type, 'email_verification'),
      gt(verificationTokens.expiresAt, new Date())
    ),
  });

  if (!verificationToken) {
    throw new Error('Token inválido ou expirado');
  }

  // Atualizar usuário
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, verificationToken.userId));

  // Deletar token
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.id, verificationToken.id));

  return true;
}

export async function forgotPassword(email: string) {
  // Buscar usuário
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  // Não revelar se email existe
  if (!user) {
    return true;
  }

  // Deletar tokens anteriores
  await db
    .delete(verificationTokens)
    .where(and(
      eq(verificationTokens.userId, user.id),
      eq(verificationTokens.type, 'password_reset')
    ));

  // Criar novo token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db.insert(verificationTokens).values({
    userId: user.id,
    token,
    type: 'password_reset',
    expiresAt,
  });

  // Enviar email
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Redefinir senha - VIPS',
    html: passwordResetTemplate(user.name || '', resetUrl),
  });

  return true;
}

export async function resetPassword(token: string, newPassword: string) {
  // Buscar token
  const verificationToken = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.token, token),
      eq(verificationTokens.type, 'password_reset'),
      gt(verificationTokens.expiresAt, new Date())
    ),
  });

  if (!verificationToken) {
    throw new Error('Token inválido ou expirado');
  }

  // Hash nova senha
  const passwordHash = await hashPassword(newPassword);

  // Atualizar usuário
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, verificationToken.userId));

  // Deletar token
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.id, verificationToken.id));

  // Invalidar todas as sessões do usuário
  await lucia.invalidateUserSessions(verificationToken.userId);

  return true;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  // Buscar usuário
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Verificar senha atual
  const validPassword = await verifyPassword(currentPassword, user.passwordHash);
  if (!validPassword) {
    throw new Error('Senha atual incorreta');
  }

  // Hash nova senha
  const passwordHash = await hashPassword(newPassword);

  // Atualizar usuário
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return true;
}

export async function resendVerificationEmail(userId: string) {
  // Buscar usuário
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  if (user.emailVerified) {
    throw new Error('Email já verificado');
  }

  // Deletar tokens anteriores
  await db
    .delete(verificationTokens)
    .where(and(
      eq(verificationTokens.userId, userId),
      eq(verificationTokens.type, 'email_verification')
    ));

  // Criar novo token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  await db.insert(verificationTokens).values({
    userId,
    token,
    type: 'email_verification',
    expiresAt,
  });

  // Enviar email
  const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verifique seu email - VIPS',
    html: emailVerificationTemplate(user.name || '', verificationUrl),
  });

  return true;
}
