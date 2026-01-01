import { app } from './app';
import { env } from '@/config/env';
import {
  validateWSConnection,
  addConnection,
  removeConnection,
  handleWSMessage,
  getConnectionStats,
} from '@/lib/websocket';

console.log(`
╔═══════════════════════════════════════════╗
║            VIPS Backend API               ║
╠═══════════════════════════════════════════╣
║  Environment: ${env.NODE_ENV.padEnd(25)}║
║  Port: ${String(env.PORT).padEnd(32)}║
║  URL: ${env.PUBLIC_URL.padEnd(33)}║
║  WebSocket: Enabled                       ║
╚═══════════════════════════════════════════╝
`);

interface WSData {
  userId: string;
  creatorId?: string;
  sessionId: string;
}

export default {
  port: env.PORT,
  hostname: '0.0.0.0',
  async fetch(req: Request, server: any) {
    const url = new URL(req.url);

    // Handle WebSocket upgrade
    if (url.pathname === '/ws') {
      const token = url.searchParams.get('token') || undefined;
      const wsData = await validateWSConnection(token);

      if (!wsData) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const upgraded = server.upgrade(req, { data: wsData });
      if (upgraded) {
        return undefined; // Bun handles WebSocket from here
      }

      return new Response(JSON.stringify({ error: 'WebSocket upgrade failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // All other requests go to Hono
    return app.fetch(req);
  },
  websocket: {
    async open(ws: import('bun').ServerWebSocket<WSData>) {
      addConnection(ws);
      ws.send(JSON.stringify({ type: 'connected', ...getConnectionStats() }));
    },
    async message(ws: import('bun').ServerWebSocket<WSData>, message: string | Buffer) {
      const data = typeof message === 'string' ? message : message.toString();
      handleWSMessage(ws, data);
    },
    async close(ws: import('bun').ServerWebSocket<WSData>) {
      removeConnection(ws);
    },
    async drain() {
      // Called when backpressure is relieved
    },
  },
};

// WebSocket upgrade is handled directly in fetch below
