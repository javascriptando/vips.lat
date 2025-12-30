import { useState, useEffect, useCallback } from 'react';

const MUTE_KEY = 'video-muted';

// Global state to sync across components
let globalMuted = typeof window !== 'undefined'
  ? localStorage.getItem(MUTE_KEY) === 'true'
  : false;

const listeners = new Set<(muted: boolean) => void>();

function notifyListeners(muted: boolean) {
  listeners.forEach(listener => listener(muted));
}

export function useVideoMute() {
  const [isMuted, setIsMuted] = useState(globalMuted);

  useEffect(() => {
    const handleChange = (muted: boolean) => {
      setIsMuted(muted);
    };

    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !globalMuted;
    globalMuted = newMuted;
    localStorage.setItem(MUTE_KEY, String(newMuted));
    notifyListeners(newMuted);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    globalMuted = muted;
    localStorage.setItem(MUTE_KEY, String(muted));
    notifyListeners(muted);
  }, []);

  return { isMuted, toggleMute, setMuted };
}
