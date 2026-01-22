import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isAdmin } from '@/lib/authorization';

export const runtime = 'nodejs';

function parseEdgeRelationPayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    relation?: string;
    description?: string | null;
    ui_priority?: number | string | null;
    max_suggestions?: number | string | null;
    allowed_parent_types?: string[] | string;
    allowed_child_types?: string[] | string;
  };
  const relation = record.relation?.trim();
  if (!relation) return null;
  const uiPriorityRaw =
    record.ui_priority === '' || record.ui_priority === undefined ? null : record.ui_priority;
  const uiPriority = uiPriorityRaw === null ? null : Number(uiPriorityRaw);
  if (uiPriority !== null && !Number.isFinite(uiPriority)) return null;
  const maxSuggestionsRaw =
    record.max_suggestions === '' || record.max_suggestions === undefined
      ? null
      : record.max_suggestions;
  const maxSuggestions = maxSuggestionsRaw === null ? null : Number(maxSuggestionsRaw);
  if (maxSuggestions !== null && !Number.isFinite(maxSuggestions)) return null;
  const parseAllowedTypes = (value: string[] | string | undefined) => {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).filter((item) => item);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter((item) => item);
          }
        } catch {
          return [];
        }
      }
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item);
    }
    return [];
  };
  const allowedParentTypes = parseAllowedTypes(record.allowed_parent_types);
  const allowedChildTypes = parseAllowedTypes(record.allowed_child_types);
  const description = record.description?.trim() || null;
  return {
    relation,
    description,
    uiPriority,
    maxSuggestions,
    allowedParentTypes,
    allowedChildTypes
  };
}

function parseEdgeRelationUpdatePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    relation?: string;
    original_relation?: string;
    description?: string | null;
    ui_priority?: number | string | null;
    max_suggestions?: number | string | null;
    allowed_parent_types?: string[] | string;
    allowed_child_types?: string[] | string;
  };
  const payload = parseEdgeRelationPayload(record);
  const originalRelation = record.original_relation?.trim();
  if (!payload || !originalRelation) return null;
  return { ...payload, originalRelation };
}

export async function GET() {
  const sessionUser = getSessionUser();
  if (!isAdmin(sessionUser)) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 });
  }
  const db = getDb();
  const relations = db
    .prepare(
      `
      SELECT relation, description, ui_priority, max_suggestions, allowed_parent_types, allowed_child_types
      FROM edge_relations
      ORDER BY relation ASC
    `
    )
    .all();

  const parsed = relations.map((relation) => ({
    ...relation,
    allowed_parent_types: safeParseArray(
      (relation as { allowed_parent_types?: string }).allowed_parent_types
    ),
    allowed_child_types: safeParseArray(
      (relation as { allowed_child_types?: string }).allowed_child_types
    )
  }));

  return NextResponse.json({ relations: parsed });
}

function safeParseArray(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter((item) => item);
    }
  } catch {
    return [];
  }
  return [];
}

export async function POST(request: Request) {
  const sessionUser = getSessionUser();
  if (!isAdmin(sessionUser)) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const payload = parseEdgeRelationPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'relation and allowed types required' },
      { status: 400 }
    );
  }
  if (payload.allowedParentTypes.length === 0 || payload.allowedChildTypes.length === 0) {
    return NextResponse.json(
      { error: 'allowed parent and child types required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const exists = db
    .prepare('SELECT 1 FROM edge_relations WHERE relation = ?')
    .get(payload.relation);
  if (exists) {
    return NextResponse.json(
      { error: 'relation already exists' },
      { status: 409 }
    );
  }
  db
    .prepare(
      `
      INSERT INTO edge_relations (
        relation,
        description,
        ui_priority,
        max_suggestions,
        allowed_parent_types,
        allowed_child_types
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      payload.relation,
      payload.description,
      payload.uiPriority,
      payload.maxSuggestions,
      JSON.stringify(payload.allowedParentTypes),
      JSON.stringify(payload.allowedChildTypes)
    );

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const sessionUser = getSessionUser();
  if (!isAdmin(sessionUser)) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const payload = parseEdgeRelationUpdatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'relation, allowed types, original_relation required' },
      { status: 400 }
    );
  }
  if (payload.allowedParentTypes.length === 0 || payload.allowedChildTypes.length === 0) {
    return NextResponse.json(
      { error: 'allowed parent and child types required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const tx = db.transaction(() => {
    if (payload.relation !== payload.originalRelation) {
      const exists = db
        .prepare('SELECT 1 FROM edge_relations WHERE relation = ?')
        .get(payload.relation);
      if (exists) {
        throw new Error('relation already exists');
      }
      db
        .prepare(
          `
          INSERT INTO edge_relations (
            relation,
            description,
            ui_priority,
            max_suggestions,
            allowed_parent_types,
            allowed_child_types
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          payload.relation,
          payload.description,
          payload.uiPriority,
          payload.maxSuggestions,
          JSON.stringify(payload.allowedParentTypes),
          JSON.stringify(payload.allowedChildTypes)
        );
      db
        .prepare('UPDATE edges SET relation = ? WHERE relation = ?')
        .run(payload.relation, payload.originalRelation);
      db
        .prepare('DELETE FROM edge_relations WHERE relation = ?')
        .run(payload.originalRelation);
    } else {
      db
        .prepare(
          `
          UPDATE edge_relations
          SET description = ?,
              ui_priority = ?,
              max_suggestions = ?,
              allowed_parent_types = ?,
              allowed_child_types = ?
          WHERE relation = ?
        `
        )
        .run(
          payload.description,
          payload.uiPriority,
          payload.maxSuggestions,
          JSON.stringify(payload.allowedParentTypes),
          JSON.stringify(payload.allowedChildTypes),
          payload.relation
        );
    }
  });

  try {
    tx();
  } catch (error) {
    const message = error instanceof Error ? error.message : null;
    if (message && message.includes('relation already exists')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to update relation' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const sessionUser = getSessionUser();
  if (!isAdmin(sessionUser)) {
    return NextResponse.json({ error: 'admin access required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const payload = parseEdgeRelationPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: 'relation required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const edgeRow = db
    .prepare('SELECT COUNT(*) AS edge_count FROM edges WHERE relation = ?')
    .get(payload.relation) as { edge_count: number } | undefined;
  if (edgeRow && edgeRow.edge_count > 0) {
    return NextResponse.json(
      { error: 'relation is in use', edge_count: edgeRow.edge_count },
      { status: 409 }
    );
  }
  const result = db
    .prepare('DELETE FROM edge_relations WHERE relation = ?')
    .run(payload.relation);
  if (result.changes === 0) {
    return NextResponse.json({ error: 'relation not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
