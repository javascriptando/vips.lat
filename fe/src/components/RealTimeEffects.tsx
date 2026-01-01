import { useEffect, useState, useCallback } from 'react';
import { Heart, MessageCircle, DollarSign } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatCurrency } from '@/lib/utils';

interface RealTimeEvent {
  id: string;
  type: 'like' | 'comment' | 'tip';
  userName: string;
  message?: string;
  amount?: number;
  timestamp: number;
}

interface RealTimeEffectsProps {
  contentId: string;
}

export function RealTimeEffects({ contentId }: RealTimeEffectsProps) {
  const [events, setEvents] = useState<RealTimeEvent[]>([]);
  const { addHandler, isConnected } = useWebSocket();

  const handleWSMessage = useCallback((message: { type: string; data?: unknown }) => {
    const data = message.data as Record<string, unknown> | undefined;
    if (!data) return;

    // Only handle events for this content
    const eventContentId = data.contentId as string;
    if (eventContentId !== contentId) return;

    const newEvent: RealTimeEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type: 'like',
      userName: '',
      timestamp: Date.now(),
    };

    switch (message.type) {
      case 'new_like':
        newEvent.type = 'like';
        newEvent.userName = (data.userName as string) || 'Alguém';
        break;
      case 'new_comment':
        newEvent.type = 'comment';
        newEvent.userName = (data.userName as string) || 'Alguém';
        newEvent.message = (data.text as string) || '';
        break;
      case 'new_tip':
        newEvent.type = 'tip';
        newEvent.userName = (data.fromName as string) || 'Alguém';
        newEvent.amount = data.amount as number;
        newEvent.message = data.message as string;
        break;
      default:
        return; // Ignore other events
    }

    setEvents(prev => [...prev, newEvent]);

    // Remove event after animation
    setTimeout(() => {
      setEvents(prev => prev.filter(e => e.id !== newEvent.id));
    }, 4000);
  }, [contentId]);

  useEffect(() => {
    if (isConnected) {
      const removeHandler = addHandler(handleWSMessage);
      return () => { removeHandler(); };
    }
  }, [isConnected, addHandler, handleWSMessage]);

  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-28 md:bottom-8 left-4 right-4 md:left-8 md:right-auto md:w-80 z-50 pointer-events-none space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="animate-slide-up bg-black/90 backdrop-blur-md rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl border border-white/10"
        >
          {event.type === 'like' && (
            <>
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {event.userName} curtiu
                </p>
                <p className="text-gray-400 text-xs">agora</p>
              </div>
            </>
          )}

          {event.type === 'comment' && (
            <>
              <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {event.userName} comentou
                </p>
                {event.message && (
                  <p className="text-gray-400 text-xs truncate">{event.message}</p>
                )}
              </div>
            </>
          )}

          {event.type === 'tip' && (
            <>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center animate-bounce">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                  {event.userName} enviou gorjeta!
                </p>
                <p className="text-green-400 text-sm font-bold">
                  {formatCurrency(event.amount || 0)}
                </p>
                {event.message && (
                  <p className="text-gray-400 text-xs truncate">{event.message}</p>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Floating hearts animation for likes
export function FloatingHearts({ contentId }: { contentId: string }) {
  const [hearts, setHearts] = useState<{ id: string; x: number }[]>([]);
  const { addHandler, isConnected } = useWebSocket();

  const handleWSMessage = useCallback((message: { type: string; data?: unknown }) => {
    if (message.type !== 'new_like') return;

    const data = message.data as Record<string, unknown> | undefined;
    if (!data || data.contentId !== contentId) return;

    // Add floating heart
    const newHeart = {
      id: `${Date.now()}-${Math.random()}`,
      x: 30 + Math.random() * 40, // Random position 30-70%
    };

    setHearts(prev => [...prev, newHeart]);

    // Remove after animation
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 2000);
  }, [contentId]);

  useEffect(() => {
    if (isConnected) {
      const removeHandler = addHandler(handleWSMessage);
      return () => { removeHandler(); };
    }
  }, [isConnected, addHandler, handleWSMessage]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute bottom-1/3 animate-float-up pointer-events-none"
          style={{ left: `${heart.x}%` }}
        >
          <Heart className="w-12 h-12 text-red-500 fill-red-500 drop-shadow-2xl" />
        </div>
      ))}
    </div>
  );
}
