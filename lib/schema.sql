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
