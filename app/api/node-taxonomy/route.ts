import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

function parseNodeTaxonomyPayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { node_id?: number; taxonomy_id?: number };
  const nodeId = Number(record.node_id);
  const taxonomyId = Number(record.taxonomy_id);
  if (!Number.isFinite(nodeId) || !Number.isFinite(taxonomyId)) return null;
  return { nodeId, taxonomyId };
}

function parseNodeTaxonomyUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    node_id?: number;
    taxonomy_id?: number;
    original_node_id?: number;
    original_taxonomy_id?: number;
  };
  const payload = parseNodeTaxonomyPayload(record);
  const originalNodeId = Number(record.original_node_id);
  const originalTaxonomyId = Number(record.original_taxonomy_id);
  if (!payload) return null;
  if (!Number.isFinite(originalNodeId) || !Number.isFinite(originalTaxonomyId)) return null;
  return { ...payload, originalNodeId, originalTaxonomyId };
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        nt.node_id,
        nt.taxonomy_id,
        n.name AS node_name,
        n.type AS node_type,
        t.key AS taxonomy_key,
        t.value AS taxonomy_value
      FROM node_taxonomy nt
      JOIN nodes n ON n.id = nt.node_id
      JOIN taxonomy t ON t.id = nt.taxonomy_id
      ORDER BY n.name ASC, t.key ASC, t.value ASC
    `
    )
    .all();

  return NextResponse.json({ node_taxonomy: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodeTaxonomyPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'node_id and taxonomy_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const taxonomyKeyRow = db
    .prepare('SELECT key FROM taxonomy WHERE id = ?')
    .get(payload.taxonomyId) as { key: string } | undefined;
  if (!taxonomyKeyRow) {
    return NextResponse.json(
      { error: 'taxonomy entry not found' },
      { status: 404 }
    );
  }
  const duplicateKey = db
    .prepare(
      `
      SELECT 1
      FROM node_taxonomy nt
      JOIN taxonomy t ON t.id = nt.taxonomy_id
      WHERE nt.node_id = ? AND t.key = ?
      LIMIT 1
    `
    )
    .get(payload.nodeId, taxonomyKeyRow.key);
  if (duplicateKey) {
    return NextResponse.json(
      { error: 'Only one taxonomy per key is allowed for a node.' },
      { status: 409 }
    );
  }
  const exists = db
    .prepare('SELECT 1 FROM node_taxonomy WHERE node_id = ? AND taxonomy_id = ?')
    .get(payload.nodeId, payload.taxonomyId);
  if (exists) {
    return NextResponse.json(
      { error: 'taxonomy link already exists' },
      { status: 409 }
    );
  }
  db
    .prepare(
      `
      INSERT INTO node_taxonomy (node_id, taxonomy_id)
      VALUES (?, ?)
    `
    )
    .run(payload.nodeId, payload.taxonomyId);

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodeTaxonomyUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'node_id, taxonomy_id, and originals required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const taxonomyKeyRow = db
    .prepare('SELECT key FROM taxonomy WHERE id = ?')
    .get(payload.taxonomyId) as { key: string } | undefined;
  if (!taxonomyKeyRow) {
    return NextResponse.json(
      { error: 'taxonomy entry not found' },
      { status: 404 }
    );
  }
  const duplicateKey = db
    .prepare(
      `
      SELECT 1
      FROM node_taxonomy nt
      JOIN taxonomy t ON t.id = nt.taxonomy_id
      WHERE nt.node_id = ?
        AND t.key = ?
        AND NOT (nt.node_id = ? AND nt.taxonomy_id = ?)
      LIMIT 1
    `
    )
    .get(
      payload.nodeId,
      taxonomyKeyRow.key,
      payload.originalNodeId,
      payload.originalTaxonomyId
    );
  if (duplicateKey) {
    return NextResponse.json(
      { error: 'Only one taxonomy per key is allowed for a node.' },
      { status: 409 }
    );
  }
  try {
    const result = db
      .prepare(
        `
        UPDATE node_taxonomy
        SET node_id = ?, taxonomy_id = ?
        WHERE node_id = ? AND taxonomy_id = ?
      `
      )
      .run(
        payload.nodeId,
        payload.taxonomyId,
        payload.originalNodeId,
        payload.originalTaxonomyId
      );
    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'taxonomy link not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'failed to update taxonomy link'
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseNodeTaxonomyPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'node_id and taxonomy_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  db
    .prepare('DELETE FROM node_taxonomy WHERE node_id = ? AND taxonomy_id = ?')
    .run(payload.nodeId, payload.taxonomyId);

  return NextResponse.json({ ok: true });
}
