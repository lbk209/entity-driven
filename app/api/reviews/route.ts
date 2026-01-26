import { NextResponse } from 'next/server';
import { getDb, previewText } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseReviewFilters } from '@/lib/reviewFilters';
import { ENTITY_REVIEW_LABEL_LIMIT } from '@/lib/constants';
import { getTaxonomyReviewBadges } from '@/lib/reviewBadges';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const sessionUser = getSessionUser();
  const { searchParams } = new URL(request.url);
  const { scope, label, nodeId, nodeNameTerms } = parseReviewFilters(searchParams, {
    isLoggedIn: Boolean(sessionUser),
    isAdmin: sessionUser?.role === 'admin'
  });

  const db = getDb();
  const confidenceFloorRaw = process.env.REVIEW_SENTIMENT_CONFIDENCE_MIN ?? '0.15';
  const confidenceFloor = Math.max(0, Number(confidenceFloorRaw) || 0);
  let rows: Array<{
    id: number;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string | null;
    entity_name: string;
    node_id: number | null;
    node_name: string | null;
  }> = [];

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];
  if (scope === 'my' && sessionUser) {
    whereClauses.push('r.user_id = ?');
    params.push(sessionUser.id);
  }
  if (label) {
    whereClauses.push(
      `
      EXISTS (
        SELECT 1
        FROM node_taxonomy nt
        JOIN taxonomy t ON t.id = nt.taxonomy_id
        WHERE nt.node_id = r.node_id
          AND t.label = ?
      )
      `
    );
    params.push(label);
  }
  if (nodeId !== null) {
    whereClauses.push('r.node_id = ?');
    params.push(nodeId);
  }
  if (nodeNameTerms.length > 0) {
    whereClauses.push(nodeNameTerms.map(() => 'LOWER(n.name) LIKE ?').join(' AND '));
    params.push(...nodeNameTerms.map((term) => `%${term}%`));
  }

  const whereClause = whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1';
  rows = db
    .prepare(
      `
      SELECT r.id, u.user_id, r.content, r.created_at, r.updated_at,
             r.entity_name,
             r.node_id,
             n.name AS node_name
      FROM review r
      JOIN user u ON u.id = r.user_id
      LEFT JOIN nodes n ON n.id = r.node_id
      WHERE ${whereClause}
      ORDER BY COALESCE(r.updated_at, r.created_at) DESC
    `
    )
    .all(...params);

  const reviews: Array<{
    id: number;
    user_id: string;
    created_at: string;
    updated_at: string | null;
    preview: string;
    entity_name: string;
    node_id: number | null;
    node_name: string | null;
    sentiment?: 'positive' | 'negative';
  }> = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    preview: previewText(row.content),
    entity_name: row.entity_name,
    node_id: row.node_id,
    node_name: row.node_name
  }));

  const hasSentimentTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='review_sentiment'")
    .get();

  if (hasSentimentTable && reviews.length > 0) {
    const reviewIds = reviews.map((review) => review.id);
    const placeholders = reviewIds.map(() => '?').join(',');
    const sentimentRows = db
      .prepare(
        `
        SELECT review_id,
               sentiment_raw,
               confidence,
               created_at
        FROM review_sentiment
        WHERE review_id IN (${placeholders})
        ORDER BY COALESCE(created_at, '') DESC, rowid DESC
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

  const labels = getTaxonomyReviewBadges(db, {
    userId: sessionUser?.id ?? null,
    limit: ENTITY_REVIEW_LABEL_LIMIT
  });

  return NextResponse.json({ reviews, labels });
}
