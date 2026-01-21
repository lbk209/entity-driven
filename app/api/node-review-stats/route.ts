import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type NodeReviewStatRow = {
  node_id: number;
  node_name: string | null;
  review_count: number;
  bayes_score: number;
};

type NodeReviewLabelRow = {
  label: string;
  node_count: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeName = searchParams.get('node_name');
  const label = searchParams.get('label')?.trim() || '';
  const sortKey = searchParams.get('sort_key') || '';
  const sortDirRaw = searchParams.get('sort_dir') || '';
  const sortDir = sortDirRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const terms = nodeName
    ? nodeName
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
    : [];

  const db = getDb();
  const labelClause = label ? 'AND t.label = ?' : '';
  const nameClause = terms.length > 0
    ? `AND ${terms.map(() => 'LOWER(n.name) LIKE ?').join(' AND ')}`
    : '';
  const params = [
    ...(label ? [label] : []),
    ...terms.map((term) => `%${term}%`)
  ];
  const orderBy = (() => {
    if (sortKey === 'name') {
      return `n.name ${sortDir}, nrs.review_count DESC`;
    }
    if (sortKey === 'bayes_score') {
      return `nrs.bayes_score ${sortDir}, nrs.review_count DESC`;
    }
    if (sortKey === 'review_count') {
      return `nrs.review_count ${sortDir}, nrs.bayes_score DESC`;
    }
    return 'nrs.review_count DESC, nrs.bayes_score DESC';
  })();

  const rows = db
    .prepare(
      `
      SELECT nrs.node_id,
             n.name AS node_name,
             nrs.review_count,
             nrs.bayes_score
      FROM node_review_stats nrs
      LEFT JOIN nodes n ON n.id = nrs.node_id
      ${label ? 'JOIN node_taxonomy nt ON nt.node_id = nrs.node_id' : ''}
      ${label ? 'JOIN taxonomy t ON t.id = nt.taxonomy_id' : ''}
      WHERE 1=1
      ${labelClause}
      ${nameClause}
      ORDER BY ${orderBy}
    `
    )
    .all(...params) as NodeReviewStatRow[];

  const labelRows = db
    .prepare(
      `
      SELECT t.label,
             COUNT(DISTINCT nrs.node_id) AS node_count
      FROM node_review_stats nrs
      JOIN node_taxonomy nt ON nt.node_id = nrs.node_id
      JOIN taxonomy t ON t.id = nt.taxonomy_id
      GROUP BY t.label
      ORDER BY node_count DESC, t.label ASC
      LIMIT 5
    `
    )
    .all() as NodeReviewLabelRow[];

  return NextResponse.json({ stats: rows, labels: labelRows });
}
