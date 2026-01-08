import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database | null = null;

const schemaSql = `
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS node_type_prior (
  node_type TEXT PRIMARY KEY,
  base_prior REAL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  UNIQUE(name, type),
  FOREIGN KEY (type) REFERENCES node_type_prior(node_type)
);

CREATE TABLE IF NOT EXISTS edge_relations (
  relation TEXT PRIMARY KEY,
  is_transitive INTEGER,
  default_weight REAL,
  description TEXT,
  allowed_parent_types TEXT NOT NULL,
  allowed_child_types TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  parent_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  UNIQUE(parent_id, child_id, relation),
  FOREIGN KEY (parent_id) REFERENCES nodes(id),
  FOREIGN KEY (child_id) REFERENCES nodes(id),
  FOREIGN KEY (relation) REFERENCES edge_relations(relation)
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  alias TEXT PRIMARY KEY,
  node_id INTEGER NOT NULL,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TRIGGER IF NOT EXISTS nodes_self_alias
AFTER INSERT ON nodes
BEGIN
  INSERT INTO entity_aliases (alias, node_id)
  VALUES (NEW.name, NEW.id);
END;

CREATE TABLE IF NOT EXISTS review_entity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  node_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  UNIQUE(review_id, node_id),
  FOREIGN KEY (review_id) REFERENCES review(id),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS review_entity_sentiment (
  review_entity_id INTEGER NOT NULL,
  sentiment_raw REAL NOT NULL,
  confidence REAL NOT NULL,
  method TEXT NOT NULL,
  version TEXT,
  created_at TEXT,
  PRIMARY KEY (review_entity_id, method, version),
  FOREIGN KEY (review_entity_id) REFERENCES review_entity(id)
);
`;

function hasForeignKey(
  dbInstance: Database.Database,
  table: string,
  column: string,
  refTable: string,
  refColumn: string
) {
  const rows = dbInstance
    .prepare(`PRAGMA foreign_key_list('${table}')`)
    .all() as Array<{ from: string; table: string; to: string }>;
  return rows.some(
    (row) => row.from === column && row.table === refTable && row.to === refColumn
  );
}

export function getDb() {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'app.sqlite');
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.exec(schemaSql);
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_type_prior (
      node_type TEXT PRIMARY KEY,
      base_prior REAL,
      updated_at TEXT
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS edge_relations (
      relation TEXT PRIMARY KEY,
      is_transitive INTEGER,
      default_weight REAL,
      description TEXT,
      allowed_parent_types TEXT NOT NULL,
      allowed_child_types TEXT NOT NULL
    );
  `);
  const edgeRelationColumns = db
    .prepare("PRAGMA table_info('edge_relations')")
    .all() as Array<{ name: string }>;
  const hasAllowedParentTypes = edgeRelationColumns.some(
    (column) => column.name === 'allowed_parent_types'
  );
  const hasAllowedChildTypes = edgeRelationColumns.some(
    (column) => column.name === 'allowed_child_types'
  );
  const hasDescription = edgeRelationColumns.some(
    (column) => column.name === 'description'
  );
  if (!hasAllowedParentTypes) {
    db.exec(
      "ALTER TABLE edge_relations ADD COLUMN allowed_parent_types TEXT NOT NULL DEFAULT '[]';"
    );
  }
  if (!hasAllowedChildTypes) {
    db.exec(
      "ALTER TABLE edge_relations ADD COLUMN allowed_child_types TEXT NOT NULL DEFAULT '[]';"
    );
  }
  if (!hasDescription) {
    db.exec("ALTER TABLE edge_relations ADD COLUMN description TEXT;");
  }
  const hasNodes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'")
    .get() as { name?: string } | undefined;
  if (!hasNodes?.name) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        UNIQUE(name, type),
        FOREIGN KEY (type) REFERENCES node_type_prior(node_type)
      );
    `);
  }
  const hasEdges = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='edges'")
    .get() as { name?: string } | undefined;
  if (!hasEdges?.name) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        parent_id INTEGER NOT NULL,
        child_id INTEGER NOT NULL,
        relation TEXT NOT NULL,
        UNIQUE(parent_id, child_id, relation),
        FOREIGN KEY (parent_id) REFERENCES nodes(id),
        FOREIGN KEY (child_id) REFERENCES nodes(id),
        FOREIGN KEY (relation) REFERENCES edge_relations(relation)
      );
    `);
  }
  db.exec(`
    INSERT OR IGNORE INTO node_type_prior (node_type, base_prior, updated_at)
    SELECT DISTINCT type, 0, datetime('now') FROM nodes;
  `);
  const allowedTypes = db
    .prepare(
      `
      SELECT DISTINCT type AS value FROM nodes
      UNION
      SELECT DISTINCT node_type AS value FROM node_type_prior
    `
    )
    .all() as Array<{ value: string }>;
  const allowedTypesJson = JSON.stringify(
    allowedTypes
      .map((row) => row.value?.trim())
      .filter((value) => value)
  );
  db
    .prepare(
      `
      INSERT OR IGNORE INTO edge_relations (
        relation,
        is_transitive,
        default_weight,
        description,
        allowed_parent_types,
        allowed_child_types
      )
      SELECT DISTINCT relation, 0, 1, NULL, ?, ? FROM edges;
    `
    )
    .run(allowedTypesJson, allowedTypesJson);
  if (!hasAllowedParentTypes || !hasAllowedChildTypes) {
    db
      .prepare(
        `
        UPDATE edge_relations
        SET allowed_parent_types = ?, allowed_child_types = ?
        WHERE allowed_parent_types IN ('[]', '') OR allowed_child_types IN ('[]', '')
      `
      )
      .run(allowedTypesJson, allowedTypesJson);
  }
  const relationDescriptions: Record<string, string> = {
    contains:
      'Indicates structural, spatial, or conceptual inclusion where one entity fully contains another. The relation is transitive.',
    sells:
      'Indicates a direct sales relationship where a vendor, restaurant, or venue sells a specific product or menu item. This relation is not transitive.',
    operates:
      'Indicates that a brand operates or manages a specific vendor, restaurant, or venue. This does not imply direct sales by the brand itself.',
    produces:
      'Indicates that a brand manufactures or creates a product or menu item, independent of where it is sold.',
    located_in:
      'Indicates the physical location of an entity within a geographic area. The relation is transitive across locations.'
  };
  for (const [relation, description] of Object.entries(relationDescriptions)) {
    db
      .prepare(
        `
        UPDATE edge_relations
        SET description = ?
        WHERE relation = ? AND (description IS NULL OR description = '')
      `
      )
      .run(description, relation);
  }
  if (hasNodes?.name && !hasForeignKey(db, 'nodes', 'type', 'node_type_prior', 'node_type')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      ALTER TABLE nodes RENAME TO nodes_old;
      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        UNIQUE(name, type),
        FOREIGN KEY (type) REFERENCES node_type_prior(node_type)
      );
      INSERT INTO nodes (id, name, type)
      SELECT id, name, type FROM nodes_old;
      DROP TABLE nodes_old;
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }
  if (
    hasEdges?.name &&
    !hasForeignKey(db, 'edges', 'relation', 'edge_relations', 'relation')
  ) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      ALTER TABLE edges RENAME TO edges_old;
      CREATE TABLE edges (
        parent_id INTEGER NOT NULL,
        child_id INTEGER NOT NULL,
        relation TEXT NOT NULL,
        UNIQUE(parent_id, child_id, relation),
        FOREIGN KEY (parent_id) REFERENCES nodes(id),
        FOREIGN KEY (child_id) REFERENCES nodes(id),
        FOREIGN KEY (relation) REFERENCES edge_relations(relation)
      );
      INSERT INTO edges (parent_id, child_id, relation)
      SELECT parent_id, child_id, relation FROM edges_old;
      DROP TABLE edges_old;
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }
  const reviewEntityColumns = db
    .prepare("PRAGMA table_info('review_entity')")
    .all() as Array<{ name: string }>;
  const reviewEntityHasNodeId = reviewEntityColumns.some((column) => column.name === 'node_id');
  const reviewEntityHasAlias = reviewEntityColumns.some((column) => column.name === 'alias');
  const reviewEntityHasEntityId = reviewEntityColumns.some((column) => column.name === 'entity_id');
  const reviewEntityHasId = reviewEntityColumns.some((column) => column.name === 'id');
  if (!reviewEntityHasNodeId || !reviewEntityHasAlias || !reviewEntityHasId) {
    const linkColumn = reviewEntityHasEntityId && !reviewEntityHasNodeId ? 'entity_id' : 'node_id';
    const aliasSelect = reviewEntityHasAlias ? 're.alias' : 'NULL';
    db.exec(`
      ALTER TABLE review_entity RENAME TO review_entity_old;
      CREATE TABLE review_entity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        node_id INTEGER NOT NULL,
        alias TEXT NOT NULL,
        UNIQUE(review_id, node_id),
        FOREIGN KEY (review_id) REFERENCES review(id),
        FOREIGN KEY (node_id) REFERENCES nodes(id)
      );
      INSERT OR IGNORE INTO review_entity (review_id, node_id, alias)
      SELECT re.review_id, re.${linkColumn}, COALESCE(${aliasSelect}, n.name, '') AS alias
      FROM review_entity_old re
      LEFT JOIN nodes n ON n.id = re.${linkColumn};
      DROP TABLE review_entity_old;
    `);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS entity_aliases (
      alias TEXT PRIMARY KEY,
      node_id INTEGER NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    );
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS nodes_self_alias
    AFTER INSERT ON nodes
    BEGIN
      INSERT INTO entity_aliases (alias, node_id)
      VALUES (NEW.name, NEW.id);
    END;
  `);
  db.exec(`
    INSERT OR IGNORE INTO entity_aliases (alias, node_id)
    SELECT name, id FROM nodes;
  `);
  db.exec('DROP TABLE IF EXISTS entity;');
  const reviewColumns = db.prepare("PRAGMA table_info('review')").all() as Array<{
    name: string;
  }>;
  const hasUpdatedAt = reviewColumns.some((column) => column.name === 'updated_at');
  if (!hasUpdatedAt) {
    db.exec('ALTER TABLE review ADD COLUMN updated_at TEXT');
  }
  return db;
}

export function previewText(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, ' ');
}
