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

CREATE TABLE IF NOT EXISTS review_entity (
  review_id INTEGER NOT NULL,
  entity_id INTEGER NOT NULL,
  PRIMARY KEY (review_id, entity_id),
  FOREIGN KEY (review_id) REFERENCES review(id),
  FOREIGN KEY (entity_id) REFERENCES nodes(id)
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
  const reviewEntityFks = db
    .prepare("PRAGMA foreign_key_list('review_entity')")
    .all() as Array<{ table: string }>;
  const reviewEntityUsesLegacy = reviewEntityFks.some((fk) => fk.table === 'entity');
  if (reviewEntityUsesLegacy) {
    db.exec(`
      ALTER TABLE review_entity RENAME TO review_entity_old;
      CREATE TABLE review_entity (
        review_id INTEGER NOT NULL,
        entity_id INTEGER NOT NULL,
        PRIMARY KEY (review_id, entity_id),
        FOREIGN KEY (review_id) REFERENCES review(id),
        FOREIGN KEY (entity_id) REFERENCES nodes(id)
      );
      INSERT OR IGNORE INTO review_entity (review_id, entity_id)
      SELECT review_id, entity_id FROM review_entity_old;
      DROP TABLE review_entity_old;
    `);
  }
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
