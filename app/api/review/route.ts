import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.user_id || !body?.password || !body?.content) {
    return NextResponse.json({ error: 'user_id, password, and content required' }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id FROM user WHERE user_id = ? AND password = ?')
    .get(body.user_id, body.password) as { id: number } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'invalid user credentials' }, { status: 401 });
  }

  const entities: Array<{ name: string; type?: string; level?: number; parent_id?: number | null }> =
    Array.isArray(body.entities) ? body.entities : [];

  const tx = db.transaction(() => {
    const reviewStmt = db.prepare(
      'INSERT INTO review (user_id, content, created_at) VALUES (?, ?, ?)'
    );
    const reviewResult = reviewStmt.run(user.id, body.content, new Date().toISOString());
    const reviewId = Number(reviewResult.lastInsertRowid);

    const insertEntity = db.prepare(
      'INSERT OR IGNORE INTO entity (name, type, level, parent_id) VALUES (?, ?, ?, ?)'
    );
    const selectEntity = db.prepare('SELECT id FROM entity WHERE name = ?');
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO review_entity (review_id, entity_id) VALUES (?, ?)'
    );

    for (const entity of entities) {
      if (!entity?.name) continue;
      insertEntity.run(
        entity.name,
        entity.type ?? null,
        entity.level ?? null,
        entity.parent_id ?? null
      );
      const row = selectEntity.get(entity.name) as { id: number } | undefined;
      if (row) {
        insertLink.run(reviewId, row.id);
      }
    }

    return reviewId;
  });

  const reviewId = tx();
  return NextResponse.json({ id: reviewId });
}
