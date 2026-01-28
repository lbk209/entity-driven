'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from './useSession';

export default function AuthButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, refresh } = useSession();
  const [isWorking, setIsWorking] = useState(false);

  const currentQuery = searchParams.toString();
  const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

  async function handleLogout() {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
      await refresh();
      const params = new URLSearchParams(searchParams.toString());
      params.set('scope', 'all');
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextUrl);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('session-change'));
      }
      router.refresh();
    } finally {
      setIsWorking(false);
    }
  }

  if (user) {
    return (
      <button
        type="button"
        className="button-link button-link--ghost"
        onClick={handleLogout}
        disabled={isWorking}
      >
        Logout
      </button>
    );
  }

  return (
    <button
      type="button"
      className="button-link button-link--ghost"
      onClick={() =>
        router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`)
      }
    >
      Login
    </button>
  );
}
