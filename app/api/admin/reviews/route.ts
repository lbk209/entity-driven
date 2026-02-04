import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isAdmin } from '@/lib/authorization';

export const runtime = 'nodejs';

type ReviewRow = {
  id: number;
  entity_id: number | null;
  entity_name: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
};

function parseReviewUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { id?: number; entity_id?: number | null };
  const id = Number(record.id);
  const entityId =
    record.entity_id === null || record.entity_id === undefined
      ? null
      : Number(record.entity_id);
  if (!Number.isFinite(id)) return null;
  if (entityId !== null && !Number.isFinite(entityId)) return null;
  return { id, entityId };
}

export async function GET() {
  const sessionUser = getSessionUser();
  if (!isAdmin(sessionUser)) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT r.id,
             r.entity_id,
             r.entity_name,
             COALESCE(u.user_id, CAST(r.user_id AS TEXT)) AS user_id,
             r.content,
             r.created_at,
             r.updated_at
      FROM review r
      LEFT JOIN user u ON u.id = r.user_id
      ORDER BY COALESCE(r.updated_at, r.created_at) DESC
    `
    )
    .all() as ReviewRow[];

  return NextResponse.json({ reviews: rows });
}

export async function PUT(request: Request) {
  const sessionUser = getSessionUser();
  if (!isAdmin(sessionUser)) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const payload = parseReviewUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'id and entity_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  if (payload.entityId !== null) {
    const nodeRow = db
      .prepare('SELECT id FROM nodes WHERE id = ?')
      .get(payload.entityId) as { id: number } | undefined;
    if (!nodeRow) {
      return NextResponse.json({ error: 'entity_id not found' }, { status: 400 });
    }
  }

  const result = db
    .prepare(
      `
      UPDATE review
      SET entity_id = ?
      WHERE id = ?
    `
    )
    .run(payload.entityId, payload.id);

  if (!result.changes) {
    return NextResponse.json({ error: 'review not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
