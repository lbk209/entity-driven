import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseAliasUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { id?: number; node_id?: number };
  const id = Number(record.id);
  const nodeId = Number(record.node_id);
  if (!Number.isFinite(id) || !Number.isFinite(nodeId)) return null;
  return { id, nodeId };
}

function parseAliasDeletePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { id?: number };
  const id = Number(record.id);
  if (!Number.isFinite(id)) return null;
  return { id };
}

export async function GET() {
  const db = getDb();
  const aliases = db
    .prepare(
      `
      SELECT re.id,
             re.alias,
             re.node_id,
             re.review_id,
             r.content AS review_content,
             n.name AS node_name,
             n.type AS node_type
      FROM review_entity re
      LEFT JOIN nodes n ON n.id = re.node_id
      LEFT JOIN review r ON r.id = re.review_id
      ORDER BY re.alias ASC, re.review_id ASC
    `
    )
    .all();

  return NextResponse.json({ aliases });
}

export async function POST() {
  return NextResponse.json(
    { error: 'aliases are derived from reviews' },
    { status: 405 }
  );
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseAliasUpdatePayload(body);
  if (!payload) {
    return NextResponse.json({ error: 'id and node_id required' }, { status: 400 });
  }

  const db = getDb();
  try {
    const result = db
      .prepare('UPDATE review_entity SET node_id = ? WHERE id = ?')
      .run(payload.nodeId, payload.id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'alias not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to update alias' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseAliasDeletePayload(body);
  if (!payload) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare('DELETE FROM review_entity WHERE id = ?').run(payload.id);
  if (result.changes === 0) {
    return NextResponse.json({ error: 'alias not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
