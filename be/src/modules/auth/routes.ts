import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppVariables } from '@/types';
import { requireAuth } from '@/middlewares/auth';
import { authRateLimit } from '@/middlewares/rateLimit';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
} from './schemas';
import * as authService from './service';

const authRoutes = new Hono<{ Variables: AppVariables }>();

// POST /api/auth/register
authRoutes.post(
  '/register',
  authRateLimit,
  zValidator('json', registerSchema),
  async (c) => {
    try {
      const input = c.req.valid('json');
      const { user, sessionCookie } = await authService.register(input);

      c.header('Set-Cookie', sessionCookie.serialize());

      return c.json({
        message: 'Cadastro realizado! Verifique seu email.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao cadastrar';
      return c.json({ error: message }, 400);
    }
  }
);

// POST /api/auth/login
authRoutes.post(
  '/login',
  authRateLimit,
  zValidator('json', loginSchema),
  async (c) => {
    try {
      const input = c.req.valid('json');
      const { user, sessionCookie } = await authService.login(input);

      c.header('Set-Cookie', sessionCookie.serialize());

      return c.json({
        message: 'Login realizado com sucesso!',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login';
      return c.json({ error: message }, 401);
    }
  }
);

// POST /api/auth/logout
authRoutes.post('/logout', requireAuth, async (c) => {
  const session = c.get('session');

  if (session) {
    const blankCookie = await authService.logout(session.id);
    c.header('Set-Cookie', blankCookie.serialize());
  }

  return c.json({ message: 'Logout realizado com sucesso!' });
});

// GET /api/auth/me
authRoutes.get('/me', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ user: null });
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// POST /api/auth/verify-email
authRoutes.post(
  '/verify-email',
  zValidator('json', verifyEmailSchema),
  async (c) => {
    try {
      const { token } = c.req.valid('json');
      await authService.verifyEmail(token);

      return c.json({ message: 'Email verificado com sucesso!' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao verificar email';
      return c.json({ error: message }, 400);
    }
  }
);

// POST /api/auth/resend-verification
authRoutes.post('/resend-verification', requireAuth, authRateLimit, async (c) => {
  try {
    const user = c.get('user')!;
    await authService.resendVerificationEmail(user.id);

    return c.json({ message: 'Email de verificação reenviado!' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao reenviar email';
    return c.json({ error: message }, 400);
  }
});

// POST /api/auth/forgot-password
authRoutes.post(
  '/forgot-password',
  authRateLimit,
  zValidator('json', forgotPasswordSchema),
  async (c) => {
    try {
      const { email } = c.req.valid('json');
      await authService.forgotPassword(email);

      // Sempre retorna sucesso para não revelar se email existe
      return c.json({
        message: 'Se o email existir, você receberá instruções para redefinir sua senha.',
      });
    } catch (error) {
      return c.json({
        message: 'Se o email existir, você receberá instruções para redefinir sua senha.',
      });
    }
  }
);

// POST /api/auth/reset-password
authRoutes.post(
  '/reset-password',
  authRateLimit,
  zValidator('json', resetPasswordSchema),
  async (c) => {
    try {
      const { token, password } = c.req.valid('json');
      await authService.resetPassword(token, password);

      return c.json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao redefinir senha';
      return c.json({ error: message }, 400);
    }
  }
);

// POST /api/auth/change-password
authRoutes.post(
  '/change-password',
  requireAuth,
  zValidator('json', changePasswordSchema),
  async (c) => {
    try {
      const user = c.get('user')!;
      const { currentPassword, newPassword } = c.req.valid('json');

      await authService.changePassword(user.id, currentPassword, newPassword);

      return c.json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
      return c.json({ error: message }, 400);
    }
  }
);

// GET /api/auth/ws-token - Get token for WebSocket authentication
authRoutes.get('/ws-token', requireAuth, async (c) => {
  const session = c.get('session');

  if (!session) {
    return c.json({ error: 'Sessão não encontrada' }, 401);
  }

  return c.json({ token: session.id });
});

export { authRoutes };
