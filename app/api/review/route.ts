import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { canEditReview } from '@/lib/authorization';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.content || !body?.entity_name) {
    return NextResponse.json(
      { error: 'content and entity_name required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const entityNameRaw = String(body.entity_name);
  if (!entityNameRaw.trim()) {
    return NextResponse.json({ error: 'entity_name required' }, { status: 400 });
  }
  const entityId =
    body.entity_id === null || body.entity_id === undefined ? null : Number(body.entity_id);
  const nodeIdLegacy =
    body.node_id === null || body.node_id === undefined ? null : Number(body.node_id);
  const effectiveEntityId = entityId ?? nodeIdLegacy;
  if (entityId !== null && !Number.isFinite(entityId)) {
    return NextResponse.json({ error: 'entity_id must be a number' }, { status: 400 });
  }
  if (nodeIdLegacy !== null && !Number.isFinite(nodeIdLegacy)) {
    return NextResponse.json({ error: 'node_id must be a number' }, { status: 400 });
  }

  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    const reviewStmt = db.prepare(
      `INSERT INTO review (user_id, content, node_id, entity_id, entity_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    if (effectiveEntityId !== null) {
      const nodeRow = db
        .prepare('SELECT id FROM nodes WHERE id = ?')
        .get(effectiveEntityId) as { id: number } | undefined;
      if (!nodeRow) {
        throw new Error('entity_id not found');
      }
    }
    const reviewResult = reviewStmt.run(
      sessionUser.id,
      body.content,
      effectiveEntityId,
      effectiveEntityId,
      entityNameRaw,
      now,
      now
    );
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
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const reviewIdParam = searchParams.get('id');
  const reviewId = reviewIdParam ? Number(reviewIdParam) : NaN;
  if (!Number.isFinite(reviewId)) {
    return NextResponse.json({ error: 'valid review id required' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.content || !body?.entity_name) {
    return NextResponse.json(
      { error: 'content and entity_name required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const reviewRow = db
    .prepare('SELECT id, user_id FROM review WHERE id = ?')
    .get(reviewId) as { id: number; user_id: number } | undefined;

  if (!reviewRow) {
    return NextResponse.json({ error: 'review not found' }, { status: 404 });
  }

  if (!canEditReview(sessionUser, reviewRow.user_id)) {
    return NextResponse.json({ error: 'review does not belong to user' }, { status: 403 });
  }

  const entityNameRaw = String(body.entity_name);
  if (!entityNameRaw.trim()) {
    return NextResponse.json({ error: 'entity_name required' }, { status: 400 });
  }
  const entityId =
    body.entity_id === null || body.entity_id === undefined ? null : Number(body.entity_id);
  const nodeIdLegacy =
    body.node_id === null || body.node_id === undefined ? null : Number(body.node_id);
  const effectiveEntityId = entityId ?? nodeIdLegacy;
  if (entityId !== null && !Number.isFinite(entityId)) {
    return NextResponse.json({ error: 'entity_id must be a number' }, { status: 400 });
  }
  if (nodeIdLegacy !== null && !Number.isFinite(nodeIdLegacy)) {
    return NextResponse.json({ error: 'node_id must be a number' }, { status: 400 });
  }

  const tx = db.transaction(() => {
    if (effectiveEntityId !== null) {
      const nodeRow = db
        .prepare('SELECT id FROM nodes WHERE id = ?')
        .get(effectiveEntityId) as { id: number } | undefined;
      if (!nodeRow) {
        throw new Error('entity_id not found');
      }
    }
    db
      .prepare(
        `
        UPDATE review
        SET content = ?, node_id = ?, entity_id = ?, entity_name = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        body.content,
        effectiveEntityId,
        effectiveEntityId,
        entityNameRaw,
        new Date().toISOString(),
        reviewId
      );
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
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const reviewIdParam = searchParams.get('id');
  const reviewId = reviewIdParam ? Number(reviewIdParam) : NaN;
  if (!Number.isFinite(reviewId)) {
    return NextResponse.json({ error: 'valid review id required' }, { status: 400 });
  }

  const db = getDb();
  const reviewRow = db
    .prepare('SELECT id, user_id FROM review WHERE id = ?')
    .get(reviewId) as { id: number; user_id: number } | undefined;

  if (!reviewRow) {
    return NextResponse.json({ error: 'review not found' }, { status: 404 });
  }

  if (!canEditReview(sessionUser, reviewRow.user_id)) {
    return NextResponse.json({ error: 'review does not belong to user' }, { status: 403 });
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM review WHERE id = ?').run(reviewId);
  });

  tx();
  return NextResponse.json({ ok: true });
}
