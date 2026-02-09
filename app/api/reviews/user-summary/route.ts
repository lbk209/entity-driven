import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { normalizeNodeId, normalizeSpecificUserId } from '@/lib/reviewFilters';
import { USER_TOP_ENTITIES_LIMIT, USER_TOP_ENTITY_SORT_MODE } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const specificUserId = normalizeSpecificUserId(searchParams.get('user_id'));
  if (!specificUserId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const entityId = normalizeNodeId(searchParams.get('entity_id'));
  const db = getDb();
  const userRow = db
    .prepare('SELECT id, user_id FROM user WHERE user_id = ? LIMIT 1')
    .get(specificUserId) as { id: number; user_id: string } | undefined;

  if (!userRow) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 });
  }

  const totals = db
    .prepare(
      `
      SELECT COUNT(*) AS review_count
      FROM review r
      WHERE r.user_id = ?
      `
    )
    .get(userRow.id) as { review_count: number };

  const entityReviewCount =
    entityId === null
      ? null
      : (db
          .prepare(
            `
            SELECT COUNT(*) AS review_count
            FROM review r
            WHERE r.user_id = ?
              AND r.entity_id = ?
            `
          )
          .get(userRow.id, entityId) as { review_count: number }).review_count;

  const keyEntityRows = db
    .prepare(
      USER_TOP_ENTITY_SORT_MODE === 'most_recent'
        ? `
          SELECT COALESCE(n.name, r.entity_name, 'Unknown') AS entity_name,
                 COUNT(*) AS review_count
          FROM review r
          LEFT JOIN nodes n ON n.id = r.entity_id
          WHERE r.user_id = ?
          GROUP BY COALESCE(n.name, r.entity_name, 'Unknown')
          ORDER BY MAX(COALESCE(r.updated_at, r.created_at)) DESC, review_count DESC, entity_name ASC
          LIMIT ?
          `
        : `
          SELECT COALESCE(n.name, r.entity_name, 'Unknown') AS entity_name,
                 COUNT(*) AS review_count
          FROM review r
          LEFT JOIN nodes n ON n.id = r.entity_id
          WHERE r.user_id = ?
          GROUP BY COALESCE(n.name, r.entity_name, 'Unknown')
          ORDER BY review_count DESC, entity_name ASC
          LIMIT ?
          `
    )
    .all(userRow.id, USER_TOP_ENTITIES_LIMIT) as Array<{ entity_name: string; review_count: number }>;

  return NextResponse.json({
    user: {
      user_id: userRow.user_id,
      display_name: userRow.user_id,
      review_count: totals.review_count,
      entity_review_count: entityReviewCount,
      key_entities: keyEntityRows.map((row) => ({
        name: row.entity_name,
        review_count: row.review_count
      }))
    }
  });
}
