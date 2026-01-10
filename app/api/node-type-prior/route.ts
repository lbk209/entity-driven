import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseNodeTypePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    node_type?: string;
    base_prior?: number | string | null;
    description?: string | null;
  };
  const nodeType = record.node_type?.trim();
  if (!nodeType) return null;
  const basePriorRaw =
    record.base_prior === '' || record.base_prior === undefined
      ? null
      : record.base_prior;
  const basePrior = basePriorRaw === null ? null : Number(basePriorRaw);
  if (basePrior !== null && !Number.isFinite(basePrior)) return null;
  const description = record.description?.trim() || null;
  return { nodeType, basePrior, description };
}

function parseNodeTypeUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    node_type?: string;
    base_prior?: number | string | null;
    original_node_type?: string;
  };
  const payload = parseNodeTypePayload(record);
  const originalNodeType = record.original_node_type?.trim();
  if (!payload || !originalNodeType) return null;
  return { ...payload, originalNodeType };
}

export async function GET() {
  const db = getDb();
  const nodeTypes = db
    .prepare(
      `
      SELECT node_type, base_prior, description, updated_at
      FROM node_type_prior
      ORDER BY node_type ASC
    `
    )
    .all();

  return NextResponse.json({ node_types: nodeTypes });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodeTypePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'node_type required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const exists = db
    .prepare('SELECT 1 FROM node_type_prior WHERE node_type = ?')
    .get(payload.nodeType);
  if (exists) {
    return NextResponse.json(
      { error: 'node type already exists' },
      { status: 409 }
    );
  }
  db
    .prepare(
      `
      INSERT INTO node_type_prior (node_type, base_prior, description, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `
    )
    .run(payload.nodeType, payload.basePrior, payload.description);

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodeTypeUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'node_type, original_node_type required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const tx = db.transaction(() => {
    if (payload.nodeType !== payload.originalNodeType) {
      const exists = db
        .prepare('SELECT 1 FROM node_type_prior WHERE node_type = ?')
        .get(payload.nodeType);
      if (exists) {
        throw new Error('node type already exists');
      }
      db
        .prepare(
          `
          INSERT INTO node_type_prior (node_type, base_prior, description, updated_at)
          VALUES (?, ?, ?, datetime('now'))
        `
        )
        .run(payload.nodeType, payload.basePrior, payload.description);
      db
        .prepare('UPDATE nodes SET type = ? WHERE type = ?')
        .run(payload.nodeType, payload.originalNodeType);
      db
        .prepare('DELETE FROM node_type_prior WHERE node_type = ?')
        .run(payload.originalNodeType);
    } else {
      db
        .prepare(
          `
          UPDATE node_type_prior
          SET base_prior = ?, description = ?, updated_at = datetime('now')
          WHERE node_type = ?
        `
        )
        .run(payload.basePrior, payload.description, payload.nodeType);
    }
  });

  try {
    tx();
  } catch (error) {
    const message = error instanceof Error ? error.message : null;
    if (message && message.includes('node type already exists')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to update node type' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodeTypePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'node_type required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const nodeRow = db
    .prepare('SELECT COUNT(*) AS node_count FROM nodes WHERE type = ?')
    .get(payload.nodeType) as { node_count: number } | undefined;
  if (nodeRow && nodeRow.node_count > 0) {
    return NextResponse.json(
      { error: 'node type is in use', node_count: nodeRow.node_count },
      { status: 409 }
    );
  }
  const result = db
    .prepare('DELETE FROM node_type_prior WHERE node_type = ?')
    .run(payload.nodeType);
  if (result.changes === 0) {
    return NextResponse.json({ error: 'node type not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
