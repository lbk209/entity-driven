import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseNodePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { id?: number; name?: string; type?: string };
  const id = Number(record.id);
  const name = record.name?.trim();
  const type = record.type?.trim();
  if (!Number.isFinite(id) || !name || !type) return null;
  return { id, name, type };
}

export async function GET() {
  const db = getDb();
  const nodes = db
    .prepare(
      `
      SELECT id, name, type
      FROM nodes
      ORDER BY name ASC, type ASC
    `
    )
    .all();

  return NextResponse.json({ nodes });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'id, name, and type required' },
      { status: 400 }
    );
  }

  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO nodes (id, name, type) VALUES (?, ?, ?)').run(
    payload.id,
    payload.name,
    payload.type
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'id, name, and type required' },
      { status: 400 }
    );
  }

  const db = getDb();
  db.prepare('DELETE FROM nodes WHERE id = ? AND name = ? AND type = ?').run(
    payload.id,
    payload.name,
    payload.type
  );

  return NextResponse.json({ ok: true });
}
