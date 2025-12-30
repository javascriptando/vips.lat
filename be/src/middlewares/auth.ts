import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { lucia } from '@/lib/auth';
import type { User, Session } from 'lucia';

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
