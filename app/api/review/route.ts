import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.user_id || !body?.password || !body?.content) {
    return NextResponse.json({ error: 'user_id, password, and content required' }, { status: 400 });
  }

  const db = getDb();
  const userRow = db
    .prepare('SELECT id, password FROM user WHERE user_id = ?')
    .get(body.user_id) as { id: number; password: string } | undefined;

  if (userRow && userRow.password !== body.password) {
    return NextResponse.json({ error: 'invalid user credentials' }, { status: 401 });
  }

  const entities: Array<{ name: string; type?: string }> =
    Array.isArray(body.entities) ? body.entities : [];

  const tx = db.transaction(() => {
    let userId = userRow?.id;
    if (!userId) {
      const userResult = db
        .prepare('INSERT INTO user (user_id, password) VALUES (?, ?)')
        .run(body.user_id, body.password);
      userId = Number(userResult.lastInsertRowid);
    }

    const now = new Date().toISOString();
    const reviewStmt = db.prepare(
      'INSERT INTO review (user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    const reviewResult = reviewStmt.run(userId, body.content, now, now);
    const reviewId = Number(reviewResult.lastInsertRowid);

    const insertEntity = db.prepare(
      'INSERT OR IGNORE INTO nodes (name, type) VALUES (?, ?)'
    );
    const selectEntity = db.prepare('SELECT id FROM nodes WHERE name = ? AND type = ?');
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO review_entity (review_id, entity_id) VALUES (?, ?)'
    );

    for (const entity of entities) {
      if (!entity?.name) continue;
      const normalizedType = entity.type?.trim() || 'default';
      insertEntity.run(
        entity.name,
        normalizedType
      );
      const row = selectEntity.get(entity.name, normalizedType) as
        | { id: number }
        | undefined;
      if (row) {
        insertLink.run(reviewId, row.id);
      }
    }

    return reviewId;
  });

  const reviewId = tx();
  return NextResponse.json({ id: reviewId });
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const reviewIdParam = searchParams.get('id');
  const reviewId = reviewIdParam ? Number(reviewIdParam) : NaN;
  if (!Number.isFinite(reviewId)) {
    return NextResponse.json({ error: 'valid review id required' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.user_id || !body?.password || !body?.content) {
    return NextResponse.json({ error: 'user_id, password, and content required' }, { status: 400 });
  }

  const db = getDb();
  const userRow = db
    .prepare('SELECT id, password FROM user WHERE user_id = ?')
    .get(body.user_id) as { id: number; password: string } | undefined;

  if (!userRow || userRow.password !== body.password) {
    return NextResponse.json({ error: 'invalid user credentials' }, { status: 401 });
  }

  const reviewRow = db
    .prepare('SELECT id, user_id FROM review WHERE id = ?')
    .get(reviewId) as { id: number; user_id: number } | undefined;

  if (!reviewRow) {
    return NextResponse.json({ error: 'review not found' }, { status: 404 });
  }

  if (reviewRow.user_id !== userRow.id) {
    return NextResponse.json({ error: 'review does not belong to user' }, { status: 403 });
  }

  const entities: Array<{ name: string; type?: string }> =
    Array.isArray(body.entities) ? body.entities : [];

  const tx = db.transaction(() => {
    db
      .prepare('UPDATE review SET content = ?, updated_at = ? WHERE id = ?')
      .run(body.content, new Date().toISOString(), reviewId);
    db.prepare('DELETE FROM review_entity WHERE review_id = ?').run(reviewId);

    const insertEntity = db.prepare(
      'INSERT OR IGNORE INTO nodes (name, type) VALUES (?, ?)'
    );
    const selectEntity = db.prepare('SELECT id FROM nodes WHERE name = ? AND type = ?');
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO review_entity (review_id, entity_id) VALUES (?, ?)'
    );

    for (const entity of entities) {
      if (!entity?.name) continue;
      const normalizedType = entity.type?.trim() || 'default';
      insertEntity.run(
        entity.name,
        normalizedType
      );
      const row = selectEntity.get(entity.name, normalizedType) as
        | { id: number }
        | undefined;
      if (row) {
        insertLink.run(reviewId, row.id);
      }
    }
  });

  tx();
  return NextResponse.json({ id: reviewId });
}
