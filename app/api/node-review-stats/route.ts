import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type NodeReviewStatRow = {
  node_id: number;
  node_name: string | null;
  review_count: number;
  bayes_score: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeIdRaw = searchParams.get('node');
  const nodeName = searchParams.get('node_name');
  const nodeId = nodeIdRaw ? Number(nodeIdRaw) : null;
  const terms = nodeName
    ? nodeName
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
    : [];

  const db = getDb();
  if (Number.isFinite(nodeId)) {
    const rows = db
      .prepare(
        `
        SELECT nrs.node_id,
               n.name AS node_name,
               nrs.review_count,
               nrs.bayes_score
        FROM node_review_stats nrs
        LEFT JOIN nodes n ON n.id = nrs.node_id
        WHERE nrs.node_id = ?
        ORDER BY nrs.review_count DESC, nrs.bayes_score DESC
      `
      )
      .all(nodeId) as NodeReviewStatRow[];
    return NextResponse.json({ stats: rows });
  }
  if (terms.length > 0) {
    const whereClause = terms.map(() => 'LOWER(n.name) LIKE ?').join(' AND ');
    const params = terms.map((term) => `%${term}%`);
    const rows = db
      .prepare(
        `
        SELECT nrs.node_id,
               n.name AS node_name,
               nrs.review_count,
               nrs.bayes_score
        FROM node_review_stats nrs
        LEFT JOIN nodes n ON n.id = nrs.node_id
        WHERE (${whereClause})
        ORDER BY nrs.review_count DESC, nrs.bayes_score DESC
      `
      )
      .all(...params) as NodeReviewStatRow[];
    return NextResponse.json({ stats: rows });
  }

  const rows = db
    .prepare(
      `
      SELECT nrs.node_id,
             n.name AS node_name,
             nrs.review_count,
             nrs.bayes_score
      FROM node_review_stats nrs
      LEFT JOIN nodes n ON n.id = nrs.node_id
      ORDER BY nrs.review_count DESC, nrs.bayes_score DESC
    `
    )
    .all() as NodeReviewStatRow[];

  return NextResponse.json({ stats: rows });
}
