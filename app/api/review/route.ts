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

    const upsertNodeType = db.prepare(
      `
        INSERT OR IGNORE INTO node_type_prior (node_type, base_prior, updated_at)
        VALUES (?, 0, datetime('now'))
      `
    );
    const insertEntity = db.prepare('INSERT INTO nodes (name, type) VALUES (?, ?)');
    const selectNode = db.prepare('SELECT id FROM nodes WHERE name = ? AND type = ?');
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO review_entity (review_id, node_id, alias) VALUES (?, ?, ?)'
    );

    for (const entity of entities) {
      if (!entity?.name) continue;
      const alias = entity.name.trim();
      if (!alias) continue;
      const normalizedType = entity.type?.trim() || 'default';
      upsertNodeType.run(normalizedType);
      const nodeRow = selectNode.get(alias, normalizedType) as { id: number } | undefined;
      let nodeId = nodeRow?.id;
      if (!nodeId) {
        const entityResult = insertEntity.run(alias, normalizedType);
        nodeId = Number(entityResult.lastInsertRowid);
      }
      if (nodeId) {
        insertLink.run(reviewId, nodeId, alias);
      }
    }

    return reviewId;
  });

  try {
    const reviewId = tx();
    return NextResponse.json({ id: reviewId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to save review' },
      { status: 400 }
    );
  }
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

    const upsertNodeType = db.prepare(
      `
        INSERT OR IGNORE INTO node_type_prior (node_type, base_prior, updated_at)
        VALUES (?, 0, datetime('now'))
      `
    );
    const insertEntity = db.prepare('INSERT INTO nodes (name, type) VALUES (?, ?)');
    const selectNode = db.prepare('SELECT id FROM nodes WHERE name = ? AND type = ?');
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO review_entity (review_id, node_id, alias) VALUES (?, ?, ?)'
    );

    for (const entity of entities) {
      if (!entity?.name) continue;
      const alias = entity.name.trim();
      if (!alias) continue;
      const normalizedType = entity.type?.trim() || 'default';
      upsertNodeType.run(normalizedType);
      const nodeRow = selectNode.get(alias, normalizedType) as { id: number } | undefined;
      let nodeId = nodeRow?.id;
      if (!nodeId) {
        const entityResult = insertEntity.run(alias, normalizedType);
        nodeId = Number(entityResult.lastInsertRowid);
      }
      if (nodeId) {
        insertLink.run(reviewId, nodeId, alias);
      }
    }
  });

  try {
    tx();
    return NextResponse.json({ id: reviewId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to update review' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const reviewIdParam = searchParams.get('id');
  const reviewId = reviewIdParam ? Number(reviewIdParam) : NaN;
  if (!Number.isFinite(reviewId)) {
    return NextResponse.json({ error: 'valid review id required' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.user_id || !body?.password) {
    return NextResponse.json({ error: 'user_id and password required' }, { status: 400 });
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

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM review_entity WHERE review_id = ?').run(reviewId);
    db.prepare('DELETE FROM review WHERE id = ?').run(reviewId);
  });

  tx();
  return NextResponse.json({ ok: true });
}
