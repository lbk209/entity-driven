import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

const allowedRelations = new Set(['contains', 'sells']);

function parseEdgePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    parent_id?: number;
    child_id?: number;
    relation?: string;
    force?: boolean;
  };
  const parentId = Number(record.parent_id);
  const childId = Number(record.child_id);
  const relation = record.relation?.trim();
  if (!Number.isFinite(parentId) || !Number.isFinite(childId)) return null;
  if (!relation || !allowedRelations.has(relation)) return null;
  return { parentId, childId, relation, force: Boolean(record.force) };
}

function parseEdgeUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    parent_id?: number;
    child_id?: number;
    relation?: string;
    original_parent_id?: number;
    original_child_id?: number;
    original_relation?: string;
  };
  const parentId = Number(record.parent_id);
  const childId = Number(record.child_id);
  const originalParentId = Number(record.original_parent_id);
  const originalChildId = Number(record.original_child_id);
  const relation = record.relation?.trim();
  const originalRelation = record.original_relation?.trim();
  if (!Number.isFinite(parentId) || !Number.isFinite(childId)) return null;
  if (!Number.isFinite(originalParentId) || !Number.isFinite(originalChildId)) return null;
  if (!relation || !allowedRelations.has(relation)) return null;
  if (!originalRelation || !allowedRelations.has(originalRelation)) return null;
  return {
    parentId,
    childId,
    relation,
    originalParentId,
    originalChildId,
    originalRelation
  };
}

export async function GET() {
  const db = getDb();
  const edges = db
    .prepare(
      `
      SELECT e.parent_id, e.child_id, e.relation,
             (SELECT COUNT(*) FROM review_entity re WHERE re.entity_id = e.parent_id) AS parent_review_count,
             (SELECT COUNT(*) FROM review_entity re WHERE re.entity_id = e.child_id) AS child_review_count
      FROM edges e
      ORDER BY e.relation ASC, e.parent_id ASC, e.child_id ASC
    `
    )
    .all();

  return NextResponse.json({ edges });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseEdgePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'parent_id, child_id, and relation required' },
      { status: 400 }
    );
  }

  const db = getDb();
  db
    .prepare(
      'INSERT OR IGNORE INTO edges (parent_id, child_id, relation) VALUES (?, ?, ?)'
    )
    .run(payload.parentId, payload.childId, payload.relation);

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseEdgeUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'parent_id, child_id, relation, and originals required' },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    db
      .prepare(
        `
        UPDATE edges
        SET parent_id = ?, child_id = ?, relation = ?
        WHERE parent_id = ? AND child_id = ? AND relation = ?
      `
      )
      .run(
        payload.parentId,
        payload.childId,
        payload.relation,
        payload.originalParentId,
        payload.originalChildId,
        payload.originalRelation
      );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to update edge' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseEdgePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'parent_id, child_id, and relation required' },
      { status: 400 }
    );
  }

  const db = getDb();
  if (!payload.force) {
    const row = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM review_entity re WHERE re.entity_id = ?) AS parent_review_count,
          (SELECT COUNT(*) FROM review_entity re WHERE re.entity_id = ?) AS child_review_count
      `
      )
      .get(payload.parentId, payload.childId) as
      | { parent_review_count: number; child_review_count: number }
      | undefined;
    if (row && (row.parent_review_count > 0 || row.child_review_count > 0)) {
      return NextResponse.json(
        {
          error: 'edge references reviewed nodes',
          parent_review_count: row.parent_review_count,
          child_review_count: row.child_review_count
        },
        { status: 409 }
      );
    }
  }
  db
    .prepare('DELETE FROM edges WHERE parent_id = ? AND child_id = ? AND relation = ?')
    .run(payload.parentId, payload.childId, payload.relation);

  return NextResponse.json({ ok: true });
}
