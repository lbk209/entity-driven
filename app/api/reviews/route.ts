import { NextResponse } from 'next/server';
import { getDb, previewText } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityName = searchParams.get('entity');
  const userId = searchParams.get('user');
  const terms = entityName
    ? entityName
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
    : [];
  const userFilter = userId ? userId.trim() : '';

  const db = getDb();
  const confidenceFloorRaw = process.env.REVIEW_SENTIMENT_CONFIDENCE_MIN ?? '0.15';
  const confidenceFloor = Math.max(0, Number(confidenceFloorRaw) || 0);
  let rows: Array<{
    id: number;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string | null;
    entities: string | null;
  }> = [];

  if (terms.length > 0) {
    const whereClause = terms.map(() => 'LOWER(re.alias) LIKE ?').join(' OR ');
    const params = terms.map((term) => `%${term}%`);
    const reviewRows = db
      .prepare(
        `
        SELECT DISTINCT re.review_id
        FROM review_entity re
        WHERE ${whereClause}
      `
      )
      .all(...params) as Array<{ review_id: number }>;
    const reviewIds = reviewRows.map((row) => row.review_id);
    if (reviewIds.length > 0) {
      const reviewPlaceholders = reviewIds.map(() => '?').join(',');
      const userClause = userFilter ? 'AND u.user_id = ?' : '';
      rows = db
        .prepare(
          `
          SELECT r.id, u.user_id, r.content, r.created_at, r.updated_at,
                 GROUP_CONCAT(re.alias, ',') AS entities
          FROM review r
          JOIN user u ON u.id = r.user_id
          LEFT JOIN review_entity re ON r.id = re.review_id
          WHERE r.id IN (
            SELECT review_id
            FROM review_entity
            WHERE review_id IN (${reviewPlaceholders})
          )
          ${userClause}
          GROUP BY r.id
          ORDER BY COALESCE(r.updated_at, r.created_at) DESC
        `
        )
        .all(...reviewIds, ...(userFilter ? [userFilter] : []));
    }
  } else {
    const userClause = userFilter ? 'WHERE u.user_id = ?' : '';
    rows = db
      .prepare(
        `
        SELECT r.id, u.user_id, r.content, r.created_at, r.updated_at,
               GROUP_CONCAT(re.alias, ',') AS entities
        FROM review r
        JOIN user u ON u.id = r.user_id
        LEFT JOIN review_entity re ON r.id = re.review_id
        ${userClause}
        GROUP BY r.id
        ORDER BY COALESCE(r.updated_at, r.created_at) DESC
      `
      )
      .all(...(userFilter ? [userFilter] : []));
  }

  const reviews: Array<{
    id: number;
    user_id: string;
    created_at: string;
    updated_at: string | null;
    preview: string;
    entities: string[];
    sentiment?: 'positive' | 'negative';
  }> = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    preview: previewText(row.content),
    entities: row.entities ? row.entities.split(',') : []
  }));

  const hasSentimentTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='review_entity_sentiment'"
    )
    .get();

  if (hasSentimentTable && reviews.length > 0) {
    const reviewIds = reviews.map((review) => review.id);
    const placeholders = reviewIds.map(() => '?').join(',');
    const sentimentRows = db
      .prepare(
        `
        SELECT re.review_id,
               res.sentiment_raw,
               res.confidence,
               res.created_at
        FROM review_entity_sentiment res
        JOIN review_entity re ON re.id = res.review_entity_id
        WHERE re.review_id IN (${placeholders})
        ORDER BY COALESCE(res.created_at, '') DESC, res.rowid DESC
      `
      )
      .all(...reviewIds) as Array<{
      review_id: number;
      sentiment_raw: number;
      confidence: number;
      created_at: string | null;
    }>;

    const sentimentByReview = new Map<number, { sentiment_raw: number; confidence: number }>();
    for (const row of sentimentRows) {
      if (sentimentByReview.has(row.review_id)) continue;
      sentimentByReview.set(row.review_id, {
        sentiment_raw: row.sentiment_raw,
        confidence: row.confidence
      });
    }

    for (const review of reviews) {
      const sentiment = sentimentByReview.get(review.id);
      if (!sentiment) continue;
      if (sentiment.confidence < confidenceFloor) continue;
      if (sentiment.sentiment_raw > 0) {
        review.sentiment = 'positive';
      } else if (sentiment.sentiment_raw < 0) {
        review.sentiment = 'negative';
      }
    }
  }

  return NextResponse.json({ reviews });
}
