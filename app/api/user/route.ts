import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.user_id || !body?.password) {
    return NextResponse.json({ error: 'user_id and password required' }, { status: 400 });
  }

  const db = getDb();
  try {
    const stmt = db.prepare('INSERT INTO user (user_id, password) VALUES (?, ?)');
    const result = stmt.run(body.user_id, body.password);
    return NextResponse.json({ id: result.lastInsertRowid, user_id: body.user_id });
  } catch (error) {
    return NextResponse.json({ error: 'user already exists' }, { status: 409 });
  }
}
