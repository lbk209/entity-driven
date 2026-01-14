import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.user_id || !body?.password || !body?.content || !body?.entity_name) {
    return NextResponse.json(
      { error: 'user_id, password, content, and entity_name required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const userRow = db
    .prepare('SELECT id, password FROM user WHERE user_id = ?')
    .get(body.user_id) as { id: number; password: string } | undefined;

  if (userRow && userRow.password !== body.password) {
    return NextResponse.json({ error: 'invalid user credentials' }, { status: 401 });
  }

  const entityNameRaw = String(body.entity_name);
  if (!entityNameRaw.trim()) {
    return NextResponse.json({ error: 'entity_name required' }, { status: 400 });
  }
  const nodeId =
    body.node_id === null || body.node_id === undefined ? null : Number(body.node_id);
  if (nodeId !== null && !Number.isFinite(nodeId)) {
    return NextResponse.json({ error: 'node_id must be a number' }, { status: 400 });
  }

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
      `INSERT INTO review (user_id, content, node_id, entity_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    if (nodeId !== null) {
      const nodeRow = db
        .prepare('SELECT id FROM nodes WHERE id = ?')
        .get(nodeId) as { id: number } | undefined;
      if (!nodeRow) {
        throw new Error('node_id not found');
      }
    }
    const reviewResult = reviewStmt.run(userId, body.content, nodeId, entityNameRaw, now, now);
    const reviewId = Number(reviewResult.lastInsertRowid);

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
  if (!body?.user_id || !body?.password || !body?.content || !body?.entity_name) {
    return NextResponse.json(
      { error: 'user_id, password, content, and entity_name required' },
      { status: 400 }
    );
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

  const entityNameRaw = String(body.entity_name);
  if (!entityNameRaw.trim()) {
    return NextResponse.json({ error: 'entity_name required' }, { status: 400 });
  }
  const nodeId =
    body.node_id === null || body.node_id === undefined ? null : Number(body.node_id);
  if (nodeId !== null && !Number.isFinite(nodeId)) {
    return NextResponse.json({ error: 'node_id must be a number' }, { status: 400 });
  }

  const tx = db.transaction(() => {
    if (nodeId !== null) {
      const nodeRow = db
        .prepare('SELECT id FROM nodes WHERE id = ?')
        .get(nodeId) as { id: number } | undefined;
      if (!nodeRow) {
        throw new Error('node_id not found');
      }
    }
    db
      .prepare(
        `
        UPDATE review
        SET content = ?, node_id = ?, entity_name = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(body.content, nodeId, entityNameRaw, new Date().toISOString(), reviewId);
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
    db.prepare('DELETE FROM review WHERE id = ?').run(reviewId);
  });

  tx();
  return NextResponse.json({ ok: true });
}
