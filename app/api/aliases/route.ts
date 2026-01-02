import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseAliasPayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { alias?: string; node_id?: number };
  const alias = record.alias?.trim();
  const nodeId = Number(record.node_id);
  if (!alias || !Number.isFinite(nodeId)) return null;
  return { alias, nodeId };
}

function parseAliasUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { alias?: string; node_id?: number; original_alias?: string };
  const alias = record.alias?.trim();
  const originalAlias = record.original_alias?.trim();
  const nodeId = Number(record.node_id);
  if (!alias || !originalAlias || !Number.isFinite(nodeId)) return null;
  return { alias, originalAlias, nodeId };
}

export async function GET() {
  const db = getDb();
  const aliases = db
    .prepare(
      `
      SELECT ea.alias, ea.node_id, n.name AS node_name, n.type AS node_type
      FROM entity_aliases ea
      LEFT JOIN nodes n ON n.id = ea.node_id
      ORDER BY ea.alias ASC
    `
    )
    .all();

  return NextResponse.json({ aliases });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseAliasPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'alias and node_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const exists = db
      .prepare('SELECT 1 FROM entity_aliases WHERE alias = ?')
      .get(payload.alias);
    if (exists) {
      return NextResponse.json({ error: 'alias already exists' }, { status: 409 });
    }
    db
      .prepare('INSERT INTO entity_aliases (alias, node_id) VALUES (?, ?)')
      .run(payload.alias, payload.nodeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : null;
    if (message && message.includes('UNIQUE constraint failed: entity_aliases.alias')) {
      return NextResponse.json({ error: 'alias already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to insert alias' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseAliasUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'alias, node_id, and original_alias required' },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const result = db
      .prepare('UPDATE entity_aliases SET alias = ?, node_id = ? WHERE alias = ?')
      .run(payload.alias, payload.nodeId, payload.originalAlias);
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
  const payload = parseAliasPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'alias and node_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const countRow = db
    .prepare('SELECT COUNT(*) AS alias_count FROM entity_aliases WHERE node_id = ?')
    .get(payload.nodeId) as { alias_count: number } | undefined;
  if (countRow && countRow.alias_count <= 1) {
    return NextResponse.json(
      { error: 'cannot remove the last alias for a node' },
      { status: 409 }
    );
  }
  const result = db
    .prepare('DELETE FROM entity_aliases WHERE alias = ?')
    .run(payload.alias);
  if (result.changes === 0) {
    return NextResponse.json({ error: 'alias not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
