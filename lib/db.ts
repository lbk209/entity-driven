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

CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  UNIQUE(name, type)
);

CREATE TABLE IF NOT EXISTS edges (
  parent_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  UNIQUE(parent_id, child_id, relation),
  FOREIGN KEY (parent_id) REFERENCES nodes(id),
  FOREIGN KEY (child_id) REFERENCES nodes(id)
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
  review_id INTEGER NOT NULL,
  node_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  PRIMARY KEY (review_id, node_id),
  FOREIGN KEY (review_id) REFERENCES review(id),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
`;

export function getDb() {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'app.sqlite');
  db = new Database(dbPath);
  db.exec(schemaSql);
  const hasNodes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'")
    .get() as { name?: string } | undefined;
  if (!hasNodes?.name) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        UNIQUE(name, type)
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
        FOREIGN KEY (child_id) REFERENCES nodes(id)
      );
    `);
  }
  const reviewEntityColumns = db
    .prepare("PRAGMA table_info('review_entity')")
    .all() as Array<{ name: string }>;
  const reviewEntityHasNodeId = reviewEntityColumns.some((column) => column.name === 'node_id');
  const reviewEntityHasAlias = reviewEntityColumns.some((column) => column.name === 'alias');
  const reviewEntityHasEntityId = reviewEntityColumns.some((column) => column.name === 'entity_id');
  if (!reviewEntityHasNodeId || !reviewEntityHasAlias) {
    const linkColumn = reviewEntityHasEntityId ? 'entity_id' : 'node_id';
    db.exec(`
      ALTER TABLE review_entity RENAME TO review_entity_old;
      CREATE TABLE review_entity (
        review_id INTEGER NOT NULL,
        node_id INTEGER NOT NULL,
        alias TEXT NOT NULL,
        PRIMARY KEY (review_id, node_id),
        FOREIGN KEY (review_id) REFERENCES review(id),
        FOREIGN KEY (node_id) REFERENCES nodes(id)
      );
      INSERT OR IGNORE INTO review_entity (review_id, node_id, alias)
      SELECT re.review_id, re.${linkColumn}, COALESCE(n.name, '') AS alias
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
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(' ');
}
