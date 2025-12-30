import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { env, isDev } from '@/config/env';
import type { User } from '@/db/schema';

// Adapter Drizzle para Lucia
const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

// Lucia instance
export const lucia = new Lucia(adapter, {
  sessionCookie: {
    name: 'vips_session',
    expires: false, // Session cookie
    attributes: {
      secure: !isDev,
      sameSite: 'lax',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      emailVerified: attributes.emailVerified,
      role: attributes.role,
      name: attributes.name,
      username: attributes.username,
      avatarUrl: attributes.avatarUrl,
    };
  },
});

// Declarar tipos para Lucia
declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<User, 'id' | 'passwordHash' | 'createdAt' | 'updatedAt' | 'asaasCustomerId'>;
  }
}

// Hash password usando Bun
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 19456,
    timeCost: 2,
  });
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

// Generate random token
export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Export types
export type Auth = typeof lucia;
