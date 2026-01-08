import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseAllowedTypes(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter((item) => item);
    }
  } catch {
    return [];
  }
  return [];
}

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
  if (!relation) return null;
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
  if (!relation) return null;
  if (!originalRelation) return null;
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
             (SELECT COUNT(*) FROM review_entity re WHERE re.node_id = e.parent_id) AS parent_review_count,
             (SELECT COUNT(*) FROM review_entity re WHERE re.node_id = e.child_id) AS child_review_count
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
  const nodeTypes = db
    .prepare(
      `
      SELECT parent.type AS parent_type, child.type AS child_type
      FROM nodes parent
      JOIN nodes child ON child.id = ?
      WHERE parent.id = ?
    `
    )
    .get(payload.childId, payload.parentId) as
    | { parent_type: string; child_type: string }
    | undefined;
  if (!nodeTypes) {
    return NextResponse.json({ error: 'parent or child node not found' }, { status: 404 });
  }
  const relationRow = db
    .prepare(
      `
      SELECT allowed_parent_types, allowed_child_types
      FROM edge_relations
      WHERE relation = ?
    `
    )
    .get(payload.relation) as
    | { allowed_parent_types?: string; allowed_child_types?: string }
    | undefined;
  if (!relationRow) {
    return NextResponse.json(
      { error: 'relation must exist in edge_relations' },
      { status: 400 }
    );
  }
  const allowedParentTypes = parseAllowedTypes(relationRow.allowed_parent_types);
  const allowedChildTypes = parseAllowedTypes(relationRow.allowed_child_types);
  if (!allowedParentTypes.includes(nodeTypes.parent_type)) {
    return NextResponse.json(
      { error: 'parent type not allowed for relation' },
      { status: 400 }
    );
  }
  if (!allowedChildTypes.includes(nodeTypes.child_type)) {
    return NextResponse.json(
      { error: 'child type not allowed for relation' },
      { status: 400 }
    );
  }
  const result = db
    .prepare(
      'INSERT OR IGNORE INTO edges (parent_id, child_id, relation) VALUES (?, ?, ?)'
    )
    .run(payload.parentId, payload.childId, payload.relation);

  if (result.changes === 0) {
    return NextResponse.json({ error: 'edge already exists' }, { status: 409 });
  }

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
  const nodeTypes = db
    .prepare(
      `
      SELECT parent.type AS parent_type, child.type AS child_type
      FROM nodes parent
      JOIN nodes child ON child.id = ?
      WHERE parent.id = ?
    `
    )
    .get(payload.childId, payload.parentId) as
    | { parent_type: string; child_type: string }
    | undefined;
  if (!nodeTypes) {
    return NextResponse.json({ error: 'parent or child node not found' }, { status: 404 });
  }
  const relationRow = db
    .prepare(
      `
      SELECT allowed_parent_types, allowed_child_types
      FROM edge_relations
      WHERE relation = ?
    `
    )
    .get(payload.relation) as
    | { allowed_parent_types?: string; allowed_child_types?: string }
    | undefined;
  if (!relationRow) {
    return NextResponse.json(
      { error: 'relation must exist in edge_relations' },
      { status: 400 }
    );
  }
  const allowedParentTypes = parseAllowedTypes(relationRow.allowed_parent_types);
  const allowedChildTypes = parseAllowedTypes(relationRow.allowed_child_types);
  if (!allowedParentTypes.includes(nodeTypes.parent_type)) {
    return NextResponse.json(
      { error: 'parent type not allowed for relation' },
      { status: 400 }
    );
  }
  if (!allowedChildTypes.includes(nodeTypes.child_type)) {
    return NextResponse.json(
      { error: 'child type not allowed for relation' },
      { status: 400 }
    );
  }
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
          (SELECT COUNT(*) FROM review_entity re WHERE re.node_id = ?) AS parent_review_count,
          (SELECT COUNT(*) FROM review_entity re WHERE re.node_id = ?) AS child_review_count
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
