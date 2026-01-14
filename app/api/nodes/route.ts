import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseNodeCreatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { name?: string; type?: string };
  const name = record.name?.trim();
  const type = record.type?.trim();
  if (!name || !type) return null;
  return { name, type };
}

function parseNodeDeletePayload(body: unknown) {
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
             (SELECT COUNT(*) FROM review r WHERE r.node_id = n.id) AS review_count,
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
  const payload = parseNodeCreatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'name and type required' },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const exists = db
      .prepare('SELECT 1 FROM nodes WHERE name = ? AND type = ?')
      .get(payload.name, payload.type);
    if (exists) {
      return NextResponse.json({ error: 'node already exists' }, { status: 409 });
    }
    const tx = db.transaction(() => {
      db
        .prepare('INSERT OR IGNORE INTO node_type (node_type, description) VALUES (?, NULL)')
        .run(payload.type);
      db
        .prepare(
          `
          INSERT INTO nodes (name, type, created_at, updated_at)
          VALUES (?, ?, datetime('now'), datetime('now'))
        `
        )
        .run(payload.name, payload.type);
    });
    tx();
  } catch (error) {
    const message = error instanceof Error ? error.message : null;
    if (message && message.includes('UNIQUE constraint failed: nodes.name, nodes.type')) {
      return NextResponse.json({ error: 'node already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to insert node' },
      { status: 400 }
    );
  }

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
      .prepare(
        `
        INSERT OR IGNORE INTO node_type (node_type, description)
        VALUES (?, NULL)
      `
      )
      .run(payload.type);
    db
      .prepare('UPDATE nodes SET id = ?, name = ?, type = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(payload.id, payload.name, payload.type, payload.originalId);
    if (payload.id !== payload.originalId) {
      db
        .prepare('UPDATE review SET node_id = ? WHERE node_id = ?')
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
  const payload = parseNodeDeletePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'id, name, and type required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM review r WHERE r.node_id = ?) AS review_count,
        (SELECT COUNT(*) FROM edges e WHERE e.parent_id = ? OR e.child_id = ?) AS edge_count
    `
    )
    .get(payload.id, payload.id, payload.id) as
    | { review_count: number; edge_count: number }
    | undefined;
  if (row && row.review_count > 0) {
    return NextResponse.json(
      { error: 'node is referenced by reviews', review_count: row.review_count },
      { status: 409 }
    );
  }
  if (!payload.force && row && row.edge_count > 0) {
    return NextResponse.json(
      { error: 'node is referenced by edges', edge_count: row.edge_count },
      { status: 409 }
    );
  }
  const tx = db.transaction(() => {
    if (payload.force && row && row.edge_count > 0) {
      db.prepare('DELETE FROM edges WHERE parent_id = ? OR child_id = ?').run(
        payload.id,
        payload.id
      );
    }
    db.prepare('DELETE FROM nodes WHERE id = ? AND name = ? AND type = ?').run(
      payload.id,
      payload.name,
      payload.type
    );
  });
  try {
    tx();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to delete node' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
