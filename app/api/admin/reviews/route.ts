import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type ReviewRow = {
  id: number;
  node_id: number | null;
  node_name: string | null;
  entity_name: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
};

function parseReviewUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { id?: number; node_id?: number | null };
  const id = Number(record.id);
  const nodeId =
    record.node_id === null || record.node_id === undefined
      ? null
      : Number(record.node_id);
  if (!Number.isFinite(id)) return null;
  if (nodeId !== null && !Number.isFinite(nodeId)) return null;
  return { id, nodeId };
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT r.id,
             r.node_id,
             n.name AS node_name,
             r.entity_name,
             COALESCE(u.user_id, CAST(r.user_id AS TEXT)) AS user_id,
             r.content,
             r.created_at,
             r.updated_at
      FROM review r
      LEFT JOIN user u ON u.id = r.user_id
      LEFT JOIN nodes n ON n.id = r.node_id
      ORDER BY COALESCE(r.updated_at, r.created_at) DESC
    `
    )
    .all() as ReviewRow[];

  return NextResponse.json({ reviews: rows });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseReviewUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'id and node_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  if (payload.nodeId !== null) {
    const nodeRow = db
      .prepare('SELECT id FROM nodes WHERE id = ?')
      .get(payload.nodeId) as { id: number } | undefined;
    if (!nodeRow) {
      return NextResponse.json({ error: 'node_id not found' }, { status: 400 });
    }
  }

  const result = db
    .prepare(
      `
      UPDATE review
      SET node_id = ?
      WHERE id = ?
    `
    )
    .run(payload.nodeId, payload.id);

  if (!result.changes) {
    return NextResponse.json({ error: 'review not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
