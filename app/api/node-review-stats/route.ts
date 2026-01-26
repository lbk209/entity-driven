import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseReviewFilters } from '@/lib/reviewFilters';
import { NODE_REVIEW_LABEL_LIMIT } from '@/lib/constants';
import { getTaxonomyNodeBadges } from '@/lib/nodeBadges';

export const runtime = 'nodejs';

type NodeReviewStatRow = {
  node_id: number;
  node_name: string | null;
  review_count: number;
  bayes_score: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionUser = getSessionUser();
  const { scope, label, nodeNameTerms } = parseReviewFilters(searchParams, {
    isLoggedIn: Boolean(sessionUser),
    isAdmin: sessionUser?.role === 'admin'
  });
  const sortKey = searchParams.get('sort_key') || '';
  const sortDirRaw = searchParams.get('sort_dir') || '';
  const sortDir = sortDirRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const db = getDb();
  const labelClause = label ? 'AND t.label = ?' : '';
  const nameClause = nodeNameTerms.length > 0
    ? `AND ${nodeNameTerms.map(() => 'LOWER(n.name) LIKE ?').join(' AND ')}`
    : '';
  const scopeClause =
    scope === 'my' && sessionUser
      ? 'AND EXISTS (SELECT 1 FROM review r WHERE r.node_id = nrs.node_id AND r.user_id = ?)'
      : '';
  const params = [
    ...(label ? [label] : []),
    ...nodeNameTerms.map((term) => `%${term}%`),
    ...(scope === 'my' && sessionUser ? [sessionUser.id] : [])
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
      ${scopeClause}
      ORDER BY ${orderBy}
    `
    )
    .all(...params) as NodeReviewStatRow[];

  const labelRows = getTaxonomyNodeBadges(db, {
    limit: NODE_REVIEW_LABEL_LIMIT
  });

  return NextResponse.json({ stats: rows, labels: labelRows });
}
