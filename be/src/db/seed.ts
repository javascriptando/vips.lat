import { db } from './index';
import { users, creators, balances } from './schema';
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

  // Criar criador de teste
  const creatorEmail = 'creator@vips.lat';

  const existingCreator = await db.query.users.findFirst({
    where: eq(users.email, creatorEmail),
  });

  if (!existingCreator) {
    const passwordHash = await hashPassword('creator123456');

    const [user] = await db
      .insert(users)
      .values({
        email: creatorEmail,
        passwordHash,
        name: 'Creator Test',
        username: 'creatortest',
        role: 'creator',
        emailVerified: true,
      })
      .returning();

    const [creator] = await db
      .insert(creators)
      .values({
        userId: user.id,
        displayName: 'Creator Test',
        bio: 'Criador de teste para desenvolvimento',
        subscriptionPrice: 2999, // R$ 29,99
      })
      .returning();

    await db.insert(balances).values({
      creatorId: creator.id,
      available: 0,
      pending: 0,
    });

    console.log('Creator created:', user.email);
  } else {
    console.log('Creator already exists');
  }

  // Criar subscriber de teste
  const subscriberEmail = 'subscriber@vips.lat';

  const existingSubscriber = await db.query.users.findFirst({
    where: eq(users.email, subscriberEmail),
  });

  if (!existingSubscriber) {
    const passwordHash = await hashPassword('subscriber123456');

    const [subscriber] = await db
      .insert(users)
      .values({
        email: subscriberEmail,
        passwordHash,
        name: 'Subscriber Test',
        username: 'subscribertest',
        role: 'subscriber',
        emailVerified: true,
      })
      .returning();

    console.log('Subscriber created:', subscriber.email);
  } else {
    console.log('Subscriber already exists');
  }

  console.log('Seed completed!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
