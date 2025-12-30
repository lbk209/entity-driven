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
    const whereClause = terms.map(() => 'LOWER(n2.name) LIKE ?').join(' OR ');
    const params = terms.map((term) => `%${term}%`);
    rows = db
      .prepare(
        `
        SELECT r.id, u.user_id, r.content, r.created_at, r.updated_at,
               GROUP_CONCAT(n.name, ',') AS entities
        FROM review r
        JOIN user u ON u.id = r.user_id
        LEFT JOIN review_entity re ON r.id = re.review_id
        LEFT JOIN nodes n ON n.id = re.entity_id
        WHERE r.id IN (
          SELECT re2.review_id
          FROM review_entity re2
          JOIN nodes n2 ON n2.id = re2.entity_id
          WHERE ${whereClause}
        )
        GROUP BY r.id
        ORDER BY COALESCE(r.updated_at, r.created_at) DESC
      `
      )
      .all(...params);
  } else {
    rows = db
      .prepare(
        `
        SELECT r.id, u.user_id, r.content, r.created_at, r.updated_at,
               GROUP_CONCAT(n.name, ',') AS entities
        FROM review r
        JOIN user u ON u.id = r.user_id
        LEFT JOIN review_entity re ON r.id = re.review_id
        LEFT JOIN nodes n ON n.id = re.entity_id
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
