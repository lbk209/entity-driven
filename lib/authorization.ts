import { getDb } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';

export function isAdmin(user: SessionUser | null) {
  return user?.role === 'admin';
}

export function canEditReview(user: SessionUser | null, reviewUserId: number) {
  if (!user) return false;
  return user.role === 'admin' || user.id === reviewUserId;
}

export function canModifyNode(user: SessionUser | null, nodeId: number) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM review WHERE user_id = ? AND node_id = ? LIMIT 1')
    .get(user.id, nodeId);
  return Boolean(row);
}
