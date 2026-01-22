import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createSession } from '@/lib/auth';

export const runtime = 'nodejs';

type AuthAction = 'login' | 'register';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action as AuthAction | undefined;
  if (!body?.user_id || !body?.password || !action) {
    return NextResponse.json(
      { error: 'user_id, password, and action required' },
      { status: 400 }
    );
  }
  if (action !== 'login' && action !== 'register') {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  const db = getDb();
  const userIdRaw = String(body.user_id).trim();
  const passwordRaw = String(body.password);
  if (!userIdRaw || !passwordRaw) {
    return NextResponse.json({ error: 'user_id and password required' }, { status: 400 });
  }

  if (action === 'register') {
    try {
      const result = db
        .prepare('INSERT INTO user (user_id, password, role) VALUES (?, ?, ?)')
        .run(userIdRaw, passwordRaw, 'user');
      const userId = Number(result.lastInsertRowid);
      createSession(userId);
      return NextResponse.json({ ok: true, role: 'user' });
    } catch (error) {
      return NextResponse.json({ error: 'user already exists' }, { status: 409 });
    }
  }

  const userRow = db
    .prepare('SELECT id, password, role FROM user WHERE user_id = ?')
    .get(userIdRaw) as { id: number; password: string; role: 'user' | 'admin' } | undefined;
  if (!userRow || userRow.password !== passwordRaw) {
    return NextResponse.json({ error: 'invalid user credentials' }, { status: 401 });
  }
  createSession(userRow.id);
  return NextResponse.json({ ok: true, role: userRow.role });
}
