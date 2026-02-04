import type { Database } from 'better-sqlite3';

export type TaxonomyNodeBadgeRow = {
  label: string;
  all_count: number;
  my_count: number;
};

export function getTaxonomyNodeBadges(
  db: Database,
  options: { limit: number; userId?: number | null }
): TaxonomyNodeBadgeRow[] {
  const { limit, userId } = options;
  if (!userId) {
    return db
      .prepare(
        `
        -- Only resolved reviews (entity_id IS NOT NULL) contribute to node badge counts.
        SELECT t.label,
               COUNT(DISTINCT r.entity_id) AS all_count,
               0 AS my_count
        FROM review r
        JOIN node_taxonomy nt ON nt.node_id = r.entity_id
        JOIN taxonomy t ON t.id = nt.taxonomy_id
        GROUP BY t.label
        ORDER BY all_count DESC, t.label ASC
        LIMIT ${limit}
      `
      )
      .all() as TaxonomyNodeBadgeRow[];
  }

  return db
    .prepare(
      `
      -- Only resolved reviews (entity_id IS NOT NULL) contribute to node badge counts.
      WITH all_counts AS (
        SELECT t.label AS label,
               COUNT(DISTINCT r.entity_id) AS all_count
        FROM review r
        JOIN node_taxonomy nt ON nt.node_id = r.entity_id
        JOIN taxonomy t ON t.id = nt.taxonomy_id
        GROUP BY t.label
      ),
      my_counts AS (
        SELECT t.label AS label,
               COUNT(DISTINCT r.entity_id) AS my_count
        FROM review r
        JOIN node_taxonomy nt ON nt.node_id = r.entity_id
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
    .all(userId) as TaxonomyNodeBadgeRow[];
}
