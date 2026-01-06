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
