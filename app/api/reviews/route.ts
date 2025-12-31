import { NextResponse } from 'next/server';
import { getDb, previewText } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityName = searchParams.get('entity');
  const terms = entityName
    ? entityName
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
    : [];

  const db = getDb();
  let rows: Array<{
    id: number;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string | null;
    entities: string | null;
  }> = [];

  if (terms.length > 0) {
    const whereClause = terms.map(() => 'LOWER(alias) LIKE ?').join(' OR ');
    const params = terms.map((term) => `%${term}%`);
    const nodeRows = db
      .prepare(
        `
        SELECT DISTINCT node_id
        FROM entity_aliases
        WHERE ${whereClause}
      `
      )
      .all(...params) as Array<{ node_id: number }>;
    const nodeIds = nodeRows.map((row) => row.node_id);
    if (nodeIds.length > 0) {
      const nodePlaceholders = nodeIds.map(() => '?').join(',');
      rows = db
        .prepare(
          `
          SELECT r.id, u.user_id, r.content, r.created_at, r.updated_at,
                 GROUP_CONCAT(re.alias, ',') AS entities
          FROM review r
          JOIN user u ON u.id = r.user_id
          LEFT JOIN review_entity re ON r.id = re.review_id
          WHERE r.id IN (
            SELECT re2.review_id
            FROM review_entity re2
            WHERE re2.node_id IN (${nodePlaceholders})
          )
          GROUP BY r.id
          ORDER BY COALESCE(r.updated_at, r.created_at) DESC
        `
        )
        .all(...nodeIds);
    }
  } else {
    rows = db
      .prepare(
        `
        SELECT r.id, u.user_id, r.content, r.created_at, r.updated_at,
               GROUP_CONCAT(re.alias, ',') AS entities
        FROM review r
        JOIN user u ON u.id = r.user_id
        LEFT JOIN review_entity re ON r.id = re.review_id
        GROUP BY r.id
        ORDER BY COALESCE(r.updated_at, r.created_at) DESC
      `
      )
      .all();
  }

  const reviews = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    preview: previewText(row.content),
    entities: row.entities ? row.entities.split(',') : []
  }));

  return NextResponse.json({ reviews });
}
