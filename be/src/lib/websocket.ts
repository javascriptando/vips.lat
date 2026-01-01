import type { ServerWebSocket } from 'bun';
import { db } from '@/db';
import { sessions, users, creators } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';

interface WSData {
  userId: string;
  creatorId?: string;
  sessionId: string;
}

// Store connections by userId
const userConnections = new Map<string, Set<ServerWebSocket<WSData>>>();
// Store connections by creatorId (for creators)
const creatorConnections = new Map<string, Set<ServerWebSocket<WSData>>>();

export type WSMessage =
  | { type: 'new_message'; data: NewMessagePayload }
  | { type: 'message_read'; data: { conversationId: string } }
  | { type: 'typing'; data: { conversationId: string; userId: string } }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'error'; message: string }
  // Content updates
  | { type: 'content_created'; data: { contentId: string; creatorId: string } }
  | { type: 'content_updated'; data: { contentId: string } }
  | { type: 'content_deleted'; data: { contentId: string } }
  // Story updates
  | { type: 'story_created'; data: { storyId: string; creatorId: string } }
  | { type: 'story_deleted'; data: { storyId: string } }
  // Subscription updates
  | { type: 'new_subscriber'; data: { subscriberId: string; subscriberName: string } }
  | { type: 'subscription_cancelled'; data: { subscriberId: string } }
  // Interactions
  | { type: 'new_like'; data: { contentId: string; userId: string } }
  | { type: 'new_comment'; data: { contentId: string; commentId: string; userId: string } }
  | { type: 'new_tip'; data: { amount: number; fromUserId: string; fromName: string; message?: string } }
  // Payment updates
  | { type: 'payment_completed'; data: { paymentId: string; type: string } }
  // Generic invalidation trigger
  | { type: 'invalidate'; data: { queryKeys: string[] } };

interface NewMessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatarUrl: string | null;
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  ppvPrice?: number | null;
  packId?: string | null;
  createdAt: string;
}

// Validate session token from cookie or query param
export async function validateWSConnection(token?: string): Promise<WSData | null> {
  if (!token) return null;

  try {
    // Find valid session
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.id, token),
        gt(sessions.expiresAt, new Date())
      ),
    });

    if (!session) return null;

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user) return null;

    // Check if user is a creator
    const creator = await db.query.creators.findFirst({
      where: eq(creators.userId, user.id),
    });

    return {
      userId: user.id,
      creatorId: creator?.id,
      sessionId: session.id,
    };
  } catch {
    return null;
  }
}

// Add connection to tracking
export function addConnection(ws: ServerWebSocket<WSData>) {
  const { userId, creatorId } = ws.data;

  // Add to user connections
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(ws);

  // Add to creator connections if applicable
  if (creatorId) {
    if (!creatorConnections.has(creatorId)) {
      creatorConnections.set(creatorId, new Set());
    }
    creatorConnections.get(creatorId)!.add(ws);
  }

  console.log(`[WS] User ${userId} connected. Total connections: ${getTotalConnections()}`);
}

// Remove connection from tracking
export function removeConnection(ws: ServerWebSocket<WSData>) {
  const { userId, creatorId } = ws.data;

  // Remove from user connections
  const userConns = userConnections.get(userId);
  if (userConns) {
    userConns.delete(ws);
    if (userConns.size === 0) {
      userConnections.delete(userId);
    }
  }

  // Remove from creator connections
  if (creatorId) {
    const creatorConns = creatorConnections.get(creatorId);
    if (creatorConns) {
      creatorConns.delete(ws);
      if (creatorConns.size === 0) {
        creatorConnections.delete(creatorId);
      }
    }
  }

  console.log(`[WS] User ${userId} disconnected. Total connections: ${getTotalConnections()}`);
}

// Send message to specific user
export function sendToUser(userId: string, message: WSMessage) {
  const conns = userConnections.get(userId);
  if (!conns) return;

  const payload = JSON.stringify(message);
  for (const ws of conns) {
    try {
      ws.send(payload);
    } catch (err) {
      console.error(`[WS] Error sending to user ${userId}:`, err);
    }
  }
}

// Send message to creator (by creatorId)
export function sendToCreator(creatorId: string, message: WSMessage) {
  const conns = creatorConnections.get(creatorId);
  if (!conns) return;

  const payload = JSON.stringify(message);
  for (const ws of conns) {
    try {
      ws.send(payload);
    } catch (err) {
      console.error(`[WS] Error sending to creator ${creatorId}:`, err);
    }
  }
}

// Broadcast new message to conversation participants
export function broadcastNewMessage(
  conversationUserId: string,
  creatorId: string,
  message: NewMessagePayload
) {
  const wsMessage: WSMessage = { type: 'new_message', data: message };

  // Send to user
  sendToUser(conversationUserId, wsMessage);

  // Send to creator
  sendToCreator(creatorId, wsMessage);
}

// Broadcast typing indicator
export function broadcastTyping(
  conversationUserId: string,
  creatorId: string,
  conversationId: string,
  typingUserId: string
) {
  const wsMessage: WSMessage = {
    type: 'typing',
    data: { conversationId, userId: typingUserId }
  };

  sendToUser(conversationUserId, wsMessage);
  sendToCreator(creatorId, wsMessage);
}

// Handle incoming WebSocket message
export function handleWSMessage(ws: ServerWebSocket<WSData>, data: string) {
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'typing':
        // Typing indicators could be handled here
        break;

      default:
        console.log(`[WS] Unknown message type: ${message.type}`);
    }
  } catch (err) {
    console.error('[WS] Error parsing message:', err);
  }
}

function getTotalConnections(): number {
  let total = 0;
  for (const conns of userConnections.values()) {
    total += conns.size;
  }
  return total;
}

// Export connection stats for monitoring
export function getConnectionStats() {
  return {
    totalConnections: getTotalConnections(),
    uniqueUsers: userConnections.size,
    uniqueCreators: creatorConnections.size,
  };
}

// Broadcast content created to all subscribers of a creator
export function broadcastContentCreated(creatorId: string, contentId: string) {
  const wsMessage: WSMessage = {
    type: 'content_created',
    data: { contentId, creatorId }
  };
  // Broadcast to all connected users (they can filter by their subscriptions)
  for (const [, conns] of userConnections) {
    const payload = JSON.stringify(wsMessage);
    for (const ws of conns) {
      try {
        ws.send(payload);
      } catch { /* ignore */ }
    }
  }
}

// Notify creator of new subscriber
export function notifyNewSubscriber(creatorId: string, subscriberId: string, subscriberName: string) {
  const wsMessage: WSMessage = {
    type: 'new_subscriber',
    data: { subscriberId, subscriberName }
  };
  sendToCreator(creatorId, wsMessage);
}

// Notify creator of new like
export function notifyNewLike(creatorId: string, contentId: string, userId: string) {
  const wsMessage: WSMessage = {
    type: 'new_like',
    data: { contentId, userId }
  };
  sendToCreator(creatorId, wsMessage);
}

// Notify creator of new comment
export function notifyNewComment(creatorId: string, contentId: string, commentId: string, userId: string) {
  const wsMessage: WSMessage = {
    type: 'new_comment',
    data: { contentId, commentId, userId }
  };
  sendToCreator(creatorId, wsMessage);
}

// Notify creator of new tip
export function notifyNewTip(creatorId: string, amount: number, fromUserId: string, fromName: string, message?: string) {
  const wsMessage: WSMessage = {
    type: 'new_tip',
    data: { amount, fromUserId, fromName, message }
  };
  sendToCreator(creatorId, wsMessage);
}

// Notify user of payment completion
export function notifyPaymentCompleted(userId: string, paymentId: string, type: string) {
  const wsMessage: WSMessage = {
    type: 'payment_completed',
    data: { paymentId, type }
  };
  sendToUser(userId, wsMessage);
}

// Send invalidation signal to user
export function sendInvalidation(userId: string, queryKeys: string[]) {
  const wsMessage: WSMessage = {
    type: 'invalidate',
    data: { queryKeys }
  };
  sendToUser(userId, wsMessage);
}

// Broadcast like to all users (for real-time effects)
export function broadcastLike(contentId: string, userId: string, userName: string) {
  const wsMessage: WSMessage = {
    type: 'new_like',
    data: { contentId, userId, userName }
  } as WSMessage;
  // Broadcast to all connected users
  for (const [, conns] of userConnections) {
    const payload = JSON.stringify(wsMessage);
    for (const ws of conns) {
      try { ws.send(payload); } catch { /* ignore */ }
    }
  }
}

// Broadcast comment to all users (for real-time effects)
export function broadcastComment(contentId: string, commentId: string, userId: string, userName: string, text: string) {
  const wsMessage = {
    type: 'new_comment',
    data: { contentId, commentId, userId, userName, text }
  };
  // Broadcast to all connected users
  for (const [, conns] of userConnections) {
    const payload = JSON.stringify(wsMessage);
    for (const ws of conns) {
      try { ws.send(payload); } catch { /* ignore */ }
    }
  }
}

// Broadcast tip to all users viewing the content (for real-time effects)
export function broadcastTip(contentId: string, creatorId: string, amount: number, fromName: string, message?: string) {
  const wsMessage = {
    type: 'new_tip',
    data: { contentId, creatorId, amount, fromUserId: '', fromName, message }
  };
  // Broadcast to all connected users
  for (const [, conns] of userConnections) {
    const payload = JSON.stringify(wsMessage);
    for (const ws of conns) {
      try { ws.send(payload); } catch { /* ignore */ }
    }
  }
}

// Broadcast story created to all users (they can filter by their follows)
export function broadcastStoryCreated(creatorId: string, storyId: string) {
  const wsMessage: WSMessage = {
    type: 'story_created',
    data: { storyId, creatorId }
  };
  // Broadcast to all connected users
  for (const [, conns] of userConnections) {
    const payload = JSON.stringify(wsMessage);
    for (const ws of conns) {
      try { ws.send(payload); } catch { /* ignore */ }
    }
  }
}

// Broadcast story deleted
export function broadcastStoryDeleted(storyId: string) {
  const wsMessage: WSMessage = {
    type: 'story_deleted',
    data: { storyId }
  };
  // Broadcast to all connected users
  for (const [, conns] of userConnections) {
    const payload = JSON.stringify(wsMessage);
    for (const ws of conns) {
      try { ws.send(payload); } catch { /* ignore */ }
    }
  }
}
