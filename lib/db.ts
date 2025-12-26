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
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS entity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT,
  level INTEGER,
  parent_id INTEGER,
  FOREIGN KEY (parent_id) REFERENCES entity(id)
);

CREATE TABLE IF NOT EXISTS review_entity (
  review_id INTEGER NOT NULL,
  entity_id INTEGER NOT NULL,
  PRIMARY KEY (review_id, entity_id),
  FOREIGN KEY (review_id) REFERENCES review(id),
  FOREIGN KEY (entity_id) REFERENCES entity(id)
);
`;

export function getDb() {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'app.sqlite');
  db = new Database(dbPath);
  db.exec(schemaSql);
  return db;
}

export function previewText(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return '';
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(' ');
}
