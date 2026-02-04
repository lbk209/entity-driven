import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { interpretReviewFilters } from '@/lib/reviewFilters';
import {
  NODE_REVIEW_LABEL_LIMIT,
  NODE_REVIEW_STATS_PAGE_SIZE,
  NODE_REVIEW_KEYWORD_VERSION
} from '@/lib/constants';
import { getTaxonomyNodeBadges } from '@/lib/nodeBadges';

export const runtime = 'nodejs';

type NodeReviewStatRow = {
  node_id: number;
  node_name: string | null;
  review_count: number;
  bayes_score: number;
  pos_keywords: string | null;
  neg_keywords: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionUser = getSessionUser();
  const { filters, error } = interpretReviewFilters({
    searchParams,
    sessionUserId: sessionUser?.id ?? null
  });
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const { label, nodeNameTerms, reviewerUserId } = filters;
  const sortKeyRaw = searchParams.get('sort_key') || '';
  const sortKey =
    sortKeyRaw === 'name' || sortKeyRaw === 'bayes_score' || sortKeyRaw === 'review_count'
      ? sortKeyRaw
      : 'review_count';
  const sortDirRaw = searchParams.get('sort_dir') || '';
  const sortDir = sortDirRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const cursorScoreRaw = searchParams.get('cursor_score');
  const cursorCountRaw = searchParams.get('cursor_count');
  const cursorNodeIdRaw = searchParams.get('cursor_node_id');
  const cursorName = searchParams.get('cursor_name');
  const cursorScore = cursorScoreRaw !== null ? Number(cursorScoreRaw) : NaN;
  const cursorCount = cursorCountRaw !== null ? Number(cursorCountRaw) : NaN;
  const cursorNodeId = cursorNodeIdRaw !== null ? Number(cursorNodeIdRaw) : NaN;

  const db = getDb();
  const labelClause = label ? 'AND t.label = ?' : '';
  const nameClause = nodeNameTerms.length > 0
    ? `AND ${nodeNameTerms.map(() => 'LOWER(n.name) LIKE ?').join(' AND ')}`
    : '';
  const scopeClause = reviewerUserId !== null
    ? 'AND EXISTS (SELECT 1 FROM review r WHERE COALESCE(r.entity_id, r.node_id) = nrs.node_id AND r.user_id = ?)'
    : '';
  const keywordVersion = NODE_REVIEW_KEYWORD_VERSION;
  const params = [
    keywordVersion,
    ...(label ? [label] : []),
    ...nodeNameTerms.map((term) => `%${term}%`),
    ...(reviewerUserId !== null ? [reviewerUserId] : [])
  ];
  const orderBy = (() => {
    if (sortKey === 'name') {
      return `COALESCE(n.name, '') ${sortDir}, nrs.review_count DESC, nrs.bayes_score DESC, nrs.node_id ASC`;
    }
    if (sortKey === 'bayes_score') {
      return `nrs.bayes_score ${sortDir}, nrs.review_count DESC, nrs.node_id ASC`;
    }
    if (sortKey === 'review_count') {
      return `nrs.review_count ${sortDir}, nrs.bayes_score DESC, nrs.node_id ASC`;
    }
    return 'nrs.review_count DESC, nrs.bayes_score DESC, nrs.node_id ASC';
  })();
  const cursorClause = (() => {
    if (!Number.isFinite(cursorScore) || !Number.isFinite(cursorCount) || !Number.isFinite(cursorNodeId)) {
      return { clause: '', params: [] as Array<string | number> };
    }
    if (sortKey === 'name') {
      if (cursorName === null) {
        return { clause: '', params: [] as Array<string | number> };
      }
      if (sortDir === 'ASC') {
        return {
          clause:
            `AND (` +
            `COALESCE(n.name, '') > ? ` +
            `OR (COALESCE(n.name, '') = ? AND (` +
            `nrs.review_count < ? ` +
            `OR (nrs.review_count = ? AND (` +
            `nrs.bayes_score < ? ` +
            `OR (nrs.bayes_score = ? AND nrs.node_id > ?)` +
            `))` +
            `))` +
            `)`,
          params: [
            cursorName,
            cursorName,
            cursorCount,
            cursorCount,
            cursorScore,
            cursorScore,
            cursorNodeId
          ]
        };
      }
      return {
        clause:
          `AND (` +
          `COALESCE(n.name, '') < ? ` +
          `OR (COALESCE(n.name, '') = ? AND (` +
          `nrs.review_count < ? ` +
          `OR (nrs.review_count = ? AND (` +
          `nrs.bayes_score < ? ` +
          `OR (nrs.bayes_score = ? AND nrs.node_id > ?)` +
          `))` +
          `))` +
          `)`,
        params: [
          cursorName,
          cursorName,
          cursorCount,
          cursorCount,
          cursorScore,
          cursorScore,
          cursorNodeId
        ]
      };
    }
    if (sortKey === 'bayes_score') {
      if (sortDir === 'ASC') {
        return {
          clause:
            `AND (` +
            `nrs.bayes_score > ? ` +
            `OR (nrs.bayes_score = ? AND (` +
            `nrs.review_count < ? ` +
            `OR (nrs.review_count = ? AND nrs.node_id > ?)` +
            `))` +
            `)`,
          params: [cursorScore, cursorScore, cursorCount, cursorCount, cursorNodeId]
        };
      }
      return {
        clause:
          `AND (` +
          `nrs.bayes_score < ? ` +
          `OR (nrs.bayes_score = ? AND (` +
          `nrs.review_count < ? ` +
          `OR (nrs.review_count = ? AND nrs.node_id > ?)` +
          `))` +
          `)`,
        params: [cursorScore, cursorScore, cursorCount, cursorCount, cursorNodeId]
      };
    }
    if (sortKey === 'review_count') {
      if (sortDir === 'ASC') {
        return {
          clause:
            `AND (` +
            `nrs.review_count > ? ` +
            `OR (nrs.review_count = ? AND (` +
            `nrs.bayes_score < ? ` +
            `OR (nrs.bayes_score = ? AND nrs.node_id > ?)` +
            `))` +
            `)`,
          params: [cursorCount, cursorCount, cursorScore, cursorScore, cursorNodeId]
        };
      }
      return {
        clause:
          `AND (` +
          `nrs.review_count < ? ` +
          `OR (nrs.review_count = ? AND (` +
          `nrs.bayes_score < ? ` +
          `OR (nrs.bayes_score = ? AND nrs.node_id > ?)` +
          `))` +
          `)`,
        params: [cursorCount, cursorCount, cursorScore, cursorScore, cursorNodeId]
      };
    }
    return { clause: '', params: [] as Array<string | number> };
  })();

  const rows = db
    .prepare(
      `
      SELECT nrs.node_id,
             n.name AS node_name,
             nrs.review_count,
             nrs.bayes_score,
             GROUP_CONCAT(CASE WHEN k.polarity = 'positive' THEN k.keyword END, ', ') AS pos_keywords,
             GROUP_CONCAT(CASE WHEN k.polarity = 'negative' THEN k.keyword END, ', ') AS neg_keywords
      FROM node_review_stats nrs
      LEFT JOIN nodes n ON n.id = nrs.node_id
      LEFT JOIN node_review_keywords k ON k.node_id = nrs.node_id AND k.version = ?
      ${label ? 'JOIN node_taxonomy nt ON nt.node_id = nrs.node_id' : ''}
      ${label ? 'JOIN taxonomy t ON t.id = nt.taxonomy_id' : ''}
      WHERE 1=1
      ${labelClause}
      ${nameClause}
      ${scopeClause}
      ${cursorClause.clause}
      GROUP BY nrs.node_id, n.name, nrs.review_count, nrs.bayes_score
      ORDER BY ${orderBy}
      LIMIT ?
    `
    )
    .all(...params, ...cursorClause.params, NODE_REVIEW_STATS_PAGE_SIZE + 1) as NodeReviewStatRow[];

  const hasMore = rows.length > NODE_REVIEW_STATS_PAGE_SIZE;
  const pageRows = rows.slice(0, NODE_REVIEW_STATS_PAGE_SIZE);

  // Badges intentionally ignore list filters; they reflect global/all vs my counts only.
  const labelRows = getTaxonomyNodeBadges(db, {
    limit: NODE_REVIEW_LABEL_LIMIT,
    userId: sessionUser?.id ?? null
  });

  const lastRow = pageRows.at(-1);
  const nextCursor = hasMore && lastRow
    ? {
        score: lastRow.bayes_score,
        count: lastRow.review_count,
        node_id: lastRow.node_id,
        name: lastRow.node_name ?? ''
      }
    : null;

  return NextResponse.json({ stats: pageRows, labels: labelRows, nextCursor });
}
