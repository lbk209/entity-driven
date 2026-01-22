import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';

export type SessionUser = {
  id: number;
  user_id: string;
  role: 'user' | 'admin';
};

const SESSION_COOKIE = 'review_session';
const SESSION_TTL_DAYS = 30;

function sessionExpiryDate() {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires;
}

function setSessionCookie(token: string, expires: Date) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires
  });
}

function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0)
  });
}

export function getSessionUser(): SessionUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('DELETE FROM user_session WHERE expires_at <= ?').run(now);
  const row = db
    .prepare(
      `
      SELECT u.id, u.user_id, u.role
      FROM user_session s
      JOIN user u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?
    `
    )
    .get(token, now) as SessionUser | undefined;
  if (!row) return null;
  return row;
}

export function createSession(userId: number) {
  const db = getDb();
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const expires = sessionExpiryDate();
  db.prepare(
    `
    INSERT INTO user_session (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(token, userId, now, expires.toISOString());
  setSessionCookie(token, expires);
}

export function clearSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    db.prepare('DELETE FROM user_session WHERE token = ?').run(token);
  }
  clearSessionCookie();
}
