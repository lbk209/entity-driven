import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type TaxonomyPayload = {
  key: string;
  value: string;
  node_type: string;
  label: string;
  description: string | null;
};

function parseTaxonomyPayload(body: unknown): TaxonomyPayload | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    key?: string;
    value?: string;
    node_type?: string;
    label?: string;
    description?: string | null;
  };
  const keyValue = record.key?.trim();
  const valueValue = record.value?.trim();
  const nodeTypeValue = record.node_type?.trim();
  const labelValue = record.label?.trim();
  if (!keyValue || !valueValue || !nodeTypeValue || !labelValue) return null;
  const description = record.description?.trim() || null;
  return {
    key: keyValue,
    value: valueValue,
    node_type: nodeTypeValue,
    label: labelValue,
    description
  };
}

function parseTaxonomyUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { id?: number };
  const payload = parseTaxonomyPayload(record);
  if (!payload || typeof record.id !== 'number') return null;
  return { ...payload, id: record.id };
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, key, value, node_type, label, description
      FROM taxonomy
      ORDER BY node_type ASC, key ASC, value ASC
    `
    )
    .all();

  return NextResponse.json({ taxonomy: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseTaxonomyPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'key, value, node_type, and label required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const exists = db
    .prepare('SELECT 1 FROM taxonomy WHERE key = ? AND value = ? AND node_type = ?')
    .get(payload.key, payload.value, payload.node_type);
  if (exists) {
    return NextResponse.json(
      { error: 'taxonomy entry already exists' },
      { status: 409 }
    );
  }
  const labelExists = db
    .prepare('SELECT 1 FROM taxonomy WHERE label = ?')
    .get(payload.label);
  if (labelExists) {
    return NextResponse.json(
      { error: 'label already exists' },
      { status: 409 }
    );
  }

  db
    .prepare(
      `
      INSERT INTO taxonomy (key, value, node_type, label, description)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(
      payload.key,
      payload.value,
      payload.node_type,
      payload.label,
      payload.description
    );

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = parseTaxonomyUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'id, key, value, node_type, and label required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM taxonomy WHERE key = ? AND value = ? AND node_type = ?')
    .get(payload.key, payload.value, payload.node_type) as
    | { id: number }
    | undefined;
  if (existing && existing.id !== payload.id) {
    return NextResponse.json(
      { error: 'taxonomy entry already exists' },
      { status: 409 }
    );
  }
  const labelExisting = db
    .prepare('SELECT id FROM taxonomy WHERE label = ?')
    .get(payload.label) as { id: number } | undefined;
  if (labelExisting && labelExisting.id !== payload.id) {
    return NextResponse.json(
      { error: 'label already exists' },
      { status: 409 }
    );
  }

  const result = db
    .prepare(
      `
      UPDATE taxonomy
      SET key = ?, value = ?, node_type = ?, label = ?, description = ?
      WHERE id = ?
    `
    )
    .run(
      payload.key,
      payload.value,
      payload.node_type,
      payload.label,
      payload.description,
      payload.id
    );
  if (result.changes === 0) {
    return NextResponse.json({ error: 'taxonomy entry not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'id required' },
      { status: 400 }
    );
  }
  const record = body as { id?: number };
  if (typeof record.id !== 'number') {
    return NextResponse.json(
      { error: 'id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const usage = db
    .prepare(
      `
      SELECT COUNT(*) AS link_count
      FROM node_taxonomy
      WHERE taxonomy_id = ?
    `
    )
    .get(record.id) as { link_count: number } | undefined;
  if (usage && usage.link_count > 0) {
    return NextResponse.json(
      { error: 'taxonomy entry is in use', link_count: usage.link_count },
      { status: 409 }
    );
  }

  const result = db
    .prepare('DELETE FROM taxonomy WHERE id = ?')
    .run(record.id);
  if (result.changes === 0) {
    return NextResponse.json({ error: 'taxonomy entry not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
