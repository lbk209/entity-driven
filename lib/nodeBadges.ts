import type { Database } from 'better-sqlite3';

export type TaxonomyNodeBadgeRow = {
  label: string;
  node_count: number;
};

export function getTaxonomyNodeBadges(
  db: Database,
  options: { limit: number }
): TaxonomyNodeBadgeRow[] {
  const { limit } = options;
  return db
    .prepare(
      `
      SELECT t.label,
             COUNT(DISTINCT r.node_id) AS node_count
      FROM review r
      JOIN node_taxonomy nt ON nt.node_id = r.node_id
      JOIN taxonomy t ON t.id = nt.taxonomy_id
      GROUP BY t.label
      ORDER BY node_count DESC, t.label ASC
      LIMIT ${limit}
    `
    )
    .all() as TaxonomyNodeBadgeRow[];
}
