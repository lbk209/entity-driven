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
  };
  const parentId = Number(record.parent_id);
  const childId = Number(record.child_id);
  const relation = record.relation?.trim();
  if (!Number.isFinite(parentId) || !Number.isFinite(childId)) return null;
  if (!relation || !allowedRelations.has(relation)) return null;
  return { parentId, childId, relation };
}

export async function GET() {
  const db = getDb();
  const edges = db
    .prepare(
      `
      SELECT parent_id, child_id, relation
      FROM edges
      ORDER BY relation ASC, parent_id ASC, child_id ASC
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
  db
    .prepare('DELETE FROM edges WHERE parent_id = ? AND child_id = ? AND relation = ?')
    .run(payload.parentId, payload.childId, payload.relation);

  return NextResponse.json({ ok: true });
}
