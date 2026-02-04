import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isAdmin } from '@/lib/authorization';

export const runtime = 'nodejs';

function parseMergePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as { source_id?: number; target_id?: number };
  const sourceId = Number(record.source_id);
  const targetId = Number(record.target_id);
  if (!Number.isFinite(sourceId) || !Number.isFinite(targetId)) return null;
  if (sourceId === targetId) return null;
  return { sourceId, targetId };
}

export async function POST(request: Request) {
  const sessionUser = getSessionUser();
  if (!isAdmin(sessionUser)) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const payload = parseMergePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'source_id and target_id required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const source = db
    .prepare('SELECT id FROM nodes WHERE id = ?')
    .get(payload.sourceId) as { id: number } | undefined;
  const target = db
    .prepare('SELECT id FROM nodes WHERE id = ?')
    .get(payload.targetId) as { id: number } | undefined;

  if (!source || !target) {
    return NextResponse.json({ error: 'source or target node not found' }, { status: 404 });
  }

  const tx = db.transaction(() => {
    db
      .prepare('UPDATE review SET node_id = ?, entity_id = ? WHERE COALESCE(entity_id, node_id) = ?')
      .run(payload.targetId, payload.targetId, payload.sourceId);

    db.prepare(
      `
      INSERT OR IGNORE INTO edges (parent_id, child_id, relation)
      SELECT ?, child_id, relation
      FROM edges
      WHERE parent_id = ?
    `
    ).run(payload.targetId, payload.sourceId);
    db.prepare('DELETE FROM edges WHERE parent_id = ?').run(payload.sourceId);

    db.prepare(
      `
      INSERT OR IGNORE INTO edges (parent_id, child_id, relation)
      SELECT parent_id, ?, relation
      FROM edges
      WHERE child_id = ?
    `
    ).run(payload.targetId, payload.sourceId);
    db.prepare('DELETE FROM edges WHERE child_id = ?').run(payload.sourceId);

    db.prepare('DELETE FROM nodes WHERE id = ?').run(payload.sourceId);
  });

  try {
    tx();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to merge nodes' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
