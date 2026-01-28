'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  function buildRedirectUrl() {
    if (!redirectTo) {
      return '/entity-reviews?scope=my';
    }
    try {
      const url = new URL(redirectTo, window.location.origin);
      url.searchParams.set('scope', 'my');
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return '/entity-reviews?scope=my';
    }
  }

  async function handleSubmit(action: 'login' | 'register') {
    if (isWorking) return;
    setIsWorking(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          password,
          action
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Authentication failed.');
        return;
      }
      await res.json().catch(() => ({}));
      router.replace(buildRedirectUrl());
    } finally {
      setIsWorking(false);
    }
  }

  function handleCancel() {
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace('/entity-reviews');
  }

  return (
    <section className="section auth-section">
      <div className="auth-card">
        <h1>Login</h1>
        <p>Use your user ID and password to log in or create an account.</p>
        <div className="auth-form">
          <label htmlFor="login-user-id">User ID</label>
          <input
            id="login-user-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="auth-actions">
            <button
              type="button"
              onClick={() => handleSubmit('login')}
              disabled={isWorking}
            >
              Login
            </button>
            <button
              type="button"
              className="button-link button-link--ghost"
              onClick={() => handleSubmit('register')}
              disabled={isWorking}
            >
              Create Account
            </button>
            <button
              type="button"
              className="button-link button-link--ghost"
              onClick={handleCancel}
              disabled={isWorking}
            >
              Cancel
            </button>
          </div>
          {message && <small>{message}</small>}
        </div>
      </div>
    </section>
  );
}
