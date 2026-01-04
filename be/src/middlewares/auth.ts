import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { lucia } from '@/lib/auth';
import type { User, Session } from 'lucia';
import { db } from '@/db';
import { creators, accountSuspensions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// Tipos para o contexto
export interface AuthVariables {
  user: User | null;
  session: Session | null;
}

// Middleware de autenticação (opcional - não bloqueia)
export async function authMiddleware(c: Context, next: Next) {
  const sessionId = getCookie(c, lucia.sessionCookieName);

  if (!sessionId) {
    c.set('user', null);
    c.set('session', null);
    return next();
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (session && session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    c.header('Set-Cookie', sessionCookie.serialize());
  }

  if (!session) {
    const blankCookie = lucia.createBlankSessionCookie();
    c.header('Set-Cookie', blankCookie.serialize());
  }

  c.set('user', user);
  c.set('session', session);

  return next();
}

// Middleware que requer autenticação
export async function requireAuth(c: Context, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  // Verificar se usuário está suspenso
  if (user.isSuspended) {
    const suspension = await db.query.accountSuspensions.findFirst({
      where: and(
        eq(accountSuspensions.userId, user.id),
        eq(accountSuspensions.isActive, true)
      ),
      orderBy: [desc(accountSuspensions.createdAt)],
    });

    if (suspension) {
      // Verificar se suspensão temporária expirou
      if (suspension.endsAt && new Date() > suspension.endsAt) {
        // Expirou - remover suspensão
        await db
          .update(accountSuspensions)
          .set({ isActive: false })
          .where(eq(accountSuspensions.id, suspension.id));
      } else {
        return c.json({
          error: 'Conta suspensa',
          reason: suspension.reason,
          type: suspension.type,
          endsAt: suspension.endsAt,
        }, 403);
      }
    }
  }

  return next();
}

// Middleware que requer role específica
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Não autorizado' }, 401);
    }

    if (!roles.includes(user.role)) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    return next();
  };
}

// Middleware que requer ser criador
export async function requireCreator(c: Context, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  if (user.role !== 'creator' && user.role !== 'admin') {
    return c.json({ error: 'Apenas criadores podem acessar este recurso' }, 403);
  }

  // Fetch and set creator on context
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, user.id),
  });

  if (!creator) {
    return c.json({ error: 'Perfil de criador não encontrado' }, 404);
  }

  c.set('creator', creator);

  return next();
}

// Middleware que requer ser admin
export async function requireAdmin(c: Context, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem acessar este recurso' }, 403);
  }

  return next();
}

// Middleware que requer email verificado
export async function requireEmailVerified(c: Context, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  if (!user.emailVerified) {
    return c.json({ error: 'Email não verificado' }, 403);
  }

  return next();
}
