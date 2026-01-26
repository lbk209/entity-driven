import type { Database } from 'better-sqlite3';

export type TaxonomyReviewBadgeRow = {
  label: string;
  all_count: number;
  my_count: number;
};

export function getTaxonomyReviewBadges(
  db: Database,
  options: { userId?: number | null; limit: number }
): TaxonomyReviewBadgeRow[] {
  const { userId, limit } = options;

  if (!userId) {
    return db
      .prepare(
        `
        SELECT t.label,
               COUNT(DISTINCT r.id) AS all_count,
               0 AS my_count
        FROM review r
        JOIN node_taxonomy nt ON nt.node_id = r.node_id
        JOIN taxonomy t ON t.id = nt.taxonomy_id
        GROUP BY t.label
        ORDER BY all_count DESC, t.label ASC
        LIMIT ${limit}
      `
      )
      .all() as TaxonomyReviewBadgeRow[];
  }

  return db
    .prepare(
      `
      WITH all_counts AS (
        SELECT t.label AS label,
               COUNT(DISTINCT r.id) AS all_count
        FROM review r
        JOIN node_taxonomy nt ON nt.node_id = r.node_id
        JOIN taxonomy t ON t.id = nt.taxonomy_id
        GROUP BY t.label
      ),
      my_counts AS (
        SELECT t.label AS label,
               COUNT(DISTINCT r.id) AS my_count
        FROM review r
        JOIN node_taxonomy nt ON nt.node_id = r.node_id
        JOIN taxonomy t ON t.id = nt.taxonomy_id
        WHERE r.user_id = ?
        GROUP BY t.label
      )
      SELECT a.label,
             a.all_count,
             COALESCE(m.my_count, 0) AS my_count
      FROM all_counts a
      LEFT JOIN my_counts m ON m.label = a.label
      ORDER BY a.all_count DESC, a.label ASC
      LIMIT ${limit}
    `
    )
    .all(userId) as TaxonomyReviewBadgeRow[];
}
