import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';

interface WebSocketContextValue {
  isConnected: boolean;
  send: (message: object) => void;
  addHandler: (handler: (message: unknown) => void) => () => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const ws = useWebSocket(isAuthenticated);

  const value = useMemo(() => ({
    isConnected: ws.isConnected,
    send: ws.send,
    addHandler: ws.addHandler,
    reconnect: ws.reconnect,
  }), [ws.isConnected, ws.send, ws.addHandler, ws.reconnect]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWS() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWS must be used within WebSocketProvider');
  }
  return context;
}
