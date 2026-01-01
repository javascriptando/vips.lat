import { db } from '@/db';
import { mediaPacks, mediaPackPurchases, creators, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { CreatePackInput, UpdatePackInput } from './schemas';

// Get creator by user ID
async function getCreatorByUserId(userId: string) {
  return db.query.creators.findFirst({
    where: eq(creators.userId, userId),
  });
}

// Create a new pack
export async function createPack(userId: string, input: CreatePackInput) {
  const creator = await getCreatorByUserId(userId);
  if (!creator) {
    throw new Error('Você precisa ser um criador para criar pacotes');
  }

  const [pack] = await db
    .insert(mediaPacks)
    .values({
      creatorId: creator.id,
      name: input.name,
      description: input.description,
      price: input.price,
      visibility: input.visibility,
      media: input.media,
      coverUrl: input.coverUrl || input.media[0]?.thumbnailUrl || input.media[0]?.url,
    })
    .returning();

  return pack;
}

// Update a pack
export async function updatePack(userId: string, packId: string, input: UpdatePackInput) {
  const creator = await getCreatorByUserId(userId);
  if (!creator) {
    throw new Error('Você precisa ser um criador');
  }

  // Verify pack belongs to creator
  const pack = await db.query.mediaPacks.findFirst({
    where: and(
      eq(mediaPacks.id, packId),
      eq(mediaPacks.creatorId, creator.id)
    ),
  });

  if (!pack) {
    throw new Error('Pacote não encontrado');
  }

  const [updated] = await db
    .update(mediaPacks)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(mediaPacks.id, packId))
    .returning();

  return updated;
}

// Delete a pack
export async function deletePack(userId: string, packId: string) {
  const creator = await getCreatorByUserId(userId);
  if (!creator) {
    throw new Error('Você precisa ser um criador');
  }

  const pack = await db.query.mediaPacks.findFirst({
    where: and(
      eq(mediaPacks.id, packId),
      eq(mediaPacks.creatorId, creator.id)
    ),
  });

  if (!pack) {
    throw new Error('Pacote não encontrado');
  }

  await db.delete(mediaPacks).where(eq(mediaPacks.id, packId));
  return true;
}

// Get creator's packs (for management)
export async function getMyPacks(userId: string, page = 1, pageSize = 20) {
  const creator = await getCreatorByUserId(userId);
  if (!creator) {
    throw new Error('Você precisa ser um criador');
  }

  const offset = (page - 1) * pageSize;

  const packs = await db
    .select()
    .from(mediaPacks)
    .where(eq(mediaPacks.creatorId, creator.id))
    .orderBy(desc(mediaPacks.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mediaPacks)
    .where(eq(mediaPacks.creatorId, creator.id));

  return {
    data: packs,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

// Get public packs for a creator profile
export async function getCreatorPublicPacks(creatorId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const packs = await db
    .select({
      id: mediaPacks.id,
      name: mediaPacks.name,
      description: mediaPacks.description,
      coverUrl: mediaPacks.coverUrl,
      price: mediaPacks.price,
      mediaCount: sql<number>`jsonb_array_length(${mediaPacks.media})`,
      salesCount: mediaPacks.salesCount,
      createdAt: mediaPacks.createdAt,
    })
    .from(mediaPacks)
    .where(and(
      eq(mediaPacks.creatorId, creatorId),
      eq(mediaPacks.visibility, 'public'),
      eq(mediaPacks.isActive, true)
    ))
    .orderBy(desc(mediaPacks.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mediaPacks)
    .where(and(
      eq(mediaPacks.creatorId, creatorId),
      eq(mediaPacks.visibility, 'public'),
      eq(mediaPacks.isActive, true)
    ));

  return {
    data: packs,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

// Get all packs for a creator (for chat - includes private)
export async function getCreatorAllPacks(userId: string) {
  const creator = await getCreatorByUserId(userId);
  if (!creator) {
    return [];
  }

  return db
    .select({
      id: mediaPacks.id,
      name: mediaPacks.name,
      description: mediaPacks.description,
      coverUrl: mediaPacks.coverUrl,
      price: mediaPacks.price,
      visibility: mediaPacks.visibility,
      mediaCount: sql<number>`jsonb_array_length(${mediaPacks.media})`,
    })
    .from(mediaPacks)
    .where(and(
      eq(mediaPacks.creatorId, creator.id),
      eq(mediaPacks.isActive, true)
    ))
    .orderBy(desc(mediaPacks.createdAt));
}

// Get pack by ID
export async function getPackById(packId: string) {
  return db.query.mediaPacks.findFirst({
    where: eq(mediaPacks.id, packId),
  });
}

// Get pack with access check (for viewing)
export async function getPackForUser(packId: string, userId: string | null) {
  const pack = await db.query.mediaPacks.findFirst({
    where: eq(mediaPacks.id, packId),
  });

  if (!pack) {
    throw new Error('Pacote não encontrado');
  }

  // Check if user has purchased
  let hasPurchased = false;
  if (userId) {
    const purchase = await db.query.mediaPackPurchases.findFirst({
      where: and(
        eq(mediaPackPurchases.packId, packId),
        eq(mediaPackPurchases.userId, userId)
      ),
    });
    hasPurchased = !!purchase;

    // Check if user is the creator
    const creator = await getCreatorByUserId(userId);
    if (creator && creator.id === pack.creatorId) {
      hasPurchased = true; // Creator always has access
    }
  }

  // Get creator info
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, pack.creatorId),
  });

  const creatorUser = creator ? await db.query.users.findFirst({
    where: eq(users.id, creator.userId),
  }) : null;

  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    coverUrl: pack.coverUrl,
    price: pack.price,
    mediaCount: (pack.media as any[])?.length || 0,
    salesCount: pack.salesCount,
    hasPurchased,
    // Only include media if purchased
    media: hasPurchased ? pack.media : [],
    creator: creator ? {
      id: creator.id,
      displayName: creator.displayName,
      username: creatorUser?.username,
      avatarUrl: creatorUser?.avatarUrl,
      verified: creator.verified,
    } : null,
    createdAt: pack.createdAt,
  };
}

// Check if user has access to pack
export async function hasPackAccess(userId: string, packId: string): Promise<boolean> {
  // Check purchase
  const purchase = await db.query.mediaPackPurchases.findFirst({
    where: and(
      eq(mediaPackPurchases.packId, packId),
      eq(mediaPackPurchases.userId, userId)
    ),
  });

  if (purchase) return true;

  // Check if user is creator
  const pack = await db.query.mediaPacks.findFirst({
    where: eq(mediaPacks.id, packId),
  });

  if (!pack) return false;

  const creator = await getCreatorByUserId(userId);
  return creator?.id === pack.creatorId;
}

// Record pack purchase
export async function recordPackPurchase(userId: string, packId: string, pricePaid: number, messageId?: string) {
  // Check if already purchased
  const existing = await db.query.mediaPackPurchases.findFirst({
    where: and(
      eq(mediaPackPurchases.packId, packId),
      eq(mediaPackPurchases.userId, userId)
    ),
  });

  if (existing) {
    throw new Error('Você já comprou este pacote');
  }

  const [purchase] = await db
    .insert(mediaPackPurchases)
    .values({
      userId,
      packId,
      pricePaid,
      messageId,
    })
    .returning();

  // Increment sales count
  await db
    .update(mediaPacks)
    .set({
      salesCount: sql`${mediaPacks.salesCount} + 1`,
    })
    .where(eq(mediaPacks.id, packId));

  return purchase;
}

// Get user's purchased packs
export async function getUserPurchasedPacks(userId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const purchases = await db
    .select({
      id: mediaPacks.id,
      name: mediaPacks.name,
      description: mediaPacks.description,
      coverUrl: mediaPacks.coverUrl,
      media: mediaPacks.media,
      purchasedAt: mediaPackPurchases.createdAt,
      creatorId: mediaPacks.creatorId,
    })
    .from(mediaPackPurchases)
    .innerJoin(mediaPacks, eq(mediaPacks.id, mediaPackPurchases.packId))
    .where(eq(mediaPackPurchases.userId, userId))
    .orderBy(desc(mediaPackPurchases.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Get creator info for each pack
  const packsWithCreator = await Promise.all(
    purchases.map(async (pack) => {
      const creator = await db.query.creators.findFirst({
        where: eq(creators.id, pack.creatorId),
      });
      const creatorUser = creator ? await db.query.users.findFirst({
        where: eq(users.id, creator.userId),
      }) : null;

      return {
        ...pack,
        creator: creator ? {
          id: creator.id,
          displayName: creator.displayName,
          username: creatorUser?.username,
          avatarUrl: creatorUser?.avatarUrl,
        } : null,
      };
    })
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mediaPackPurchases)
    .where(eq(mediaPackPurchases.userId, userId));

  return {
    data: packsWithCreator,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}
