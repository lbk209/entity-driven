import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseNodePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { id?: number; name?: string; type?: string; force?: boolean };
  const id = Number(record.id);
  const name = record.name?.trim();
  const type = record.type?.trim();
  if (!Number.isFinite(id) || !name || !type) return null;
  return { id, name, type, force: Boolean(record.force) };
}

function parseNodeUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    id?: number;
    name?: string;
    type?: string;
    original_id?: number;
  };
  const id = Number(record.id);
  const originalId = Number(record.original_id);
  const name = record.name?.trim();
  const type = record.type?.trim();
  if (!Number.isFinite(id) || !Number.isFinite(originalId) || !name || !type) return null;
  return { id, originalId, name, type };
}

export async function GET() {
  const db = getDb();
  const nodes = db
    .prepare(
      `
      SELECT n.id, n.name, n.type,
             (SELECT COUNT(*) FROM review_entity re WHERE re.entity_id = n.id) AS review_count,
             (SELECT COUNT(*) FROM edges e WHERE e.parent_id = n.id OR e.child_id = n.id) AS edge_count
      FROM nodes n
      ORDER BY n.name ASC, n.type ASC
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

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodeUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'id, name, type, and original_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const tx = db.transaction(() => {
    db
      .prepare('UPDATE nodes SET id = ?, name = ?, type = ? WHERE id = ?')
      .run(payload.id, payload.name, payload.type, payload.originalId);
    if (payload.id !== payload.originalId) {
      db
        .prepare('UPDATE review_entity SET entity_id = ? WHERE entity_id = ?')
        .run(payload.id, payload.originalId);
      db
        .prepare('UPDATE edges SET parent_id = ? WHERE parent_id = ?')
        .run(payload.id, payload.originalId);
      db
        .prepare('UPDATE edges SET child_id = ? WHERE child_id = ?')
        .run(payload.id, payload.originalId);
    }
  });

  try {
    tx();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to update node' },
      { status: 400 }
    );
  }

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
  if (!payload.force) {
    const row = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM review_entity re WHERE re.entity_id = ?) AS review_count,
          (SELECT COUNT(*) FROM edges e WHERE e.parent_id = ? OR e.child_id = ?) AS edge_count
      `
      )
      .get(payload.id, payload.id, payload.id) as
      | { review_count: number; edge_count: number }
      | undefined;
    if (row && (row.review_count > 0 || row.edge_count > 0)) {
      return NextResponse.json(
        {
          error: 'node is referenced',
          review_count: row.review_count,
          edge_count: row.edge_count
        },
        { status: 409 }
      );
    }
  }
  db.prepare('DELETE FROM nodes WHERE id = ? AND name = ? AND type = ?').run(
    payload.id,
    payload.name,
    payload.type
  );

  return NextResponse.json({ ok: true });
}
