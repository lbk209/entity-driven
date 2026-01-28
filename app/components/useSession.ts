'use client';

import { useCallback, useEffect, useState } from 'react';

export type SessionUser = {
  id: number;
  user_id: string;
  role: 'user' | 'admin';
};

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/session', { cache: 'no-store' });
      const data = (await res.json()) as { user: SessionUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSessionChange = () => {
      refresh();
    };
    window.addEventListener('session-change', handleSessionChange);
    return () => window.removeEventListener('session-change', handleSessionChange);
  }, [refresh]);

  return { user, isLoading, refresh };
}
