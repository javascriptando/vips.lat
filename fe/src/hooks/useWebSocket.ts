import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type WSMessageType =
  | 'connected'
  | 'new_message'
  | 'message_read'
  | 'typing'
  | 'ping'
  | 'pong'
  | 'error'
  | 'content_created'
  | 'content_updated'
  | 'content_deleted'
  | 'story_created'
  | 'story_deleted'
  | 'new_subscriber'
  | 'subscription_cancelled'
  | 'new_like'
  | 'new_comment'
  | 'new_tip'
  | 'payment_completed'
  | 'invalidate';

interface WSMessage {
  type: WSMessageType;
  data?: unknown;
  message?: string;
}

type MessageHandler = (message: WSMessage) => void;

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_DELAY = 30000;
const WS_PING_INTERVAL = 30000;

export function useWebSocket(enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const isConnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  const addHandler = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  const notifyHandlers = useCallback((message: WSMessage) => {
    handlersRef.current.forEach(handler => {
      try {
        handler(message);
      } catch (err) {
        console.error('[WS] Handler error:', err);
      }
    });
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);

      // Handle pong silently
      if (message.type === 'pong') return;

      // Notify all handlers
      notifyHandlers(message);

      // Auto-invalidate React Query based on message type
      switch (message.type) {
        case 'content_created':
        case 'content_updated':
        case 'content_deleted':
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          queryClient.invalidateQueries({ queryKey: ['exploreFeed'] });
          queryClient.invalidateQueries({ queryKey: ['content'] });
          queryClient.invalidateQueries({ queryKey: ['creatorContent'] });
          queryClient.invalidateQueries({ queryKey: ['myContent'] });
          break;

        case 'story_created':
        case 'story_deleted':
          queryClient.invalidateQueries({ queryKey: ['stories'] });
          queryClient.invalidateQueries({ queryKey: ['myStories'] });
          break;

        case 'new_message':
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          queryClient.invalidateQueries({ queryKey: ['unread-count'] });
          break;

        case 'new_subscriber':
        case 'subscription_cancelled':
          queryClient.invalidateQueries({ queryKey: ['subscribers'] });
          queryClient.invalidateQueries({ queryKey: ['creator-stats'] });
          break;

        case 'new_like':
        case 'new_comment':
          // Invalidate feed and content to get updated counts
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          queryClient.invalidateQueries({ queryKey: ['exploreFeed'] });
          queryClient.invalidateQueries({ queryKey: ['content'] });
          queryClient.invalidateQueries({ queryKey: ['comments'] });
          break;

        case 'new_tip':
          queryClient.invalidateQueries({ queryKey: ['earnings'] });
          queryClient.invalidateQueries({ queryKey: ['balance'] });
          break;

        case 'payment_completed':
          queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
          queryClient.invalidateQueries({ queryKey: ['purchased'] });
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          break;

        case 'invalidate':
          // Generic invalidation - invalidate specified query keys
          const data = message.data as { queryKeys: string[] } | undefined;
          if (data?.queryKeys) {
            data.queryKeys.forEach(key => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
          }
          break;
      }
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  }, [queryClient, notifyHandlers]);

  const cleanupConnection = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  const connect = useCallback(async () => {
    // Prevent multiple connection attempts or if unmounted
    if (isConnectingRef.current || !isMountedRef.current) {
      return;
    }

    // Check if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    isConnectingRef.current = true;

    try {
      // Get WebSocket token
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:7777';
      const response = await fetch(`${apiUrl}/api/auth/ws-token`, { credentials: 'include' });

      // Check if still mounted after async operation
      if (!isMountedRef.current) {
        isConnectingRef.current = false;
        return;
      }

      if (!response.ok) {
        isConnectingRef.current = false;
        return;
      }
      const { token } = await response.json();

      // Check if we should still connect (might have been disabled during fetch)
      if (!shouldReconnectRef.current || !isMountedRef.current) {
        isConnectingRef.current = false;
        return;
      }

      // Close any existing connection first
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      // Connect to WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, WS_PING_INTERVAL);
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        if (!isMountedRef.current) return;

        setIsConnected(false);
        isConnectingRef.current = false;
        cleanupConnection();

        // Only reconnect if we should and still mounted
        if (shouldReconnectRef.current && isMountedRef.current) {
          const delay = Math.min(
            WS_RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current),
            WS_MAX_RECONNECT_DELAY
          );
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
      };
    } catch {
      isConnectingRef.current = false;

      // Retry connection if we should and still mounted
      if (shouldReconnectRef.current && isMountedRef.current) {
        const delay = Math.min(
          WS_RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current),
          WS_MAX_RECONNECT_DELAY
        );
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, delay);
      }
    }
  }, [handleMessage, cleanupConnection]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    isConnectingRef.current = false;
    cleanupConnection();

    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect trigger
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [cleanupConnection]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      shouldReconnectRef.current = true;
      reconnectAttemptsRef.current = 0;
      // Small delay to prevent React Strict Mode double-mount issues
      const timer = setTimeout(() => {
        if (isMountedRef.current) connect();
      }, 100);

      return () => {
        clearTimeout(timer);
        isMountedRef.current = false;
        disconnect();
      };
    } else {
      disconnect();
      return () => {
        isMountedRef.current = false;
      };
    }
  }, [enabled, connect, disconnect]);

  // Handle page visibility changes - reconnect when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && !isConnected && isMountedRef.current) {
        shouldReconnectRef.current = true;
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, isConnected, connect]);

  return {
    isConnected,
    send,
    addHandler,
    reconnect: connect,
  };
}
