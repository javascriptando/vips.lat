import { db } from './index';
import { users } from './schema';
import { hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding database...');

  // Criar admin
  const adminEmail = 'admin@vips.lat';

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  if (!existingAdmin) {
    const passwordHash = await hashPassword('admin123456');

    const [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash,
        name: 'Admin',
        username: 'admin',
        role: 'admin',
        emailVerified: true,
      })
      .returning();

    console.log('Admin created:', admin.email);
  } else {
    console.log('Admin already exists');
  }

  console.log('Seed completed!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
