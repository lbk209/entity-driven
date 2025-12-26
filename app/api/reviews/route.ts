import { NextResponse } from 'next/server';
import { getDb, previewText } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityName = searchParams.get('entity');

  const db = getDb();
  let rows: Array<{
    id: number;
    user_id: number;
    content: string;
    created_at: string;
    entities: string | null;
  }> = [];

  if (entityName) {
    rows = db
      .prepare(
        `
        SELECT r.id, r.user_id, r.content, r.created_at,
               GROUP_CONCAT(e.name, ',') AS entities
        FROM review r
        LEFT JOIN review_entity re ON r.id = re.review_id
        LEFT JOIN entity e ON e.id = re.entity_id
        WHERE r.id IN (
          SELECT re2.review_id
          FROM review_entity re2
          JOIN entity e2 ON e2.id = re2.entity_id
          WHERE e2.name = ?
        )
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `
      )
      .all(entityName);
  } else {
    rows = db
      .prepare(
        `
        SELECT r.id, r.user_id, r.content, r.created_at,
               GROUP_CONCAT(e.name, ',') AS entities
        FROM review r
        LEFT JOIN review_entity re ON r.id = re.review_id
        LEFT JOIN entity e ON e.id = re.entity_id
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `
      )
      .all();
  }

  const reviews = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    preview: previewText(row.content),
    entities: row.entities ? row.entities.split(',') : []
  }));

  return NextResponse.json({ reviews });
}
