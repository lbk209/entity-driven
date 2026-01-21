CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  node_id INTEGER,
  entity_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS node_type (
  node_type TEXT PRIMARY KEY,
  description TEXT
);

CREATE TABLE IF NOT EXISTS edge_relations (
  relation TEXT PRIMARY KEY,
  description TEXT,
  ui_priority INTEGER,
  max_suggestions INTEGER,
  allowed_parent_types TEXT NOT NULL,
  allowed_child_types TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(name, type),
  FOREIGN KEY (type) REFERENCES node_type(node_type)
);

CREATE TABLE IF NOT EXISTS taxonomy (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  node_type TEXT NOT NULL,
  label TEXT NOT NULL UNIQUE,
  description TEXT,
  UNIQUE(key, value, node_type),
  FOREIGN KEY (node_type) REFERENCES node_type(node_type)
);

CREATE TABLE IF NOT EXISTS node_taxonomy (
  node_id INTEGER NOT NULL,
  taxonomy_id INTEGER NOT NULL,
  PRIMARY KEY (node_id, taxonomy_id),
  FOREIGN KEY (node_id) REFERENCES nodes(id),
  FOREIGN KEY (taxonomy_id) REFERENCES taxonomy(id)
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

CREATE TABLE IF NOT EXISTS review_sentiment (
  review_id INTEGER NOT NULL,
  sentiment_raw REAL NOT NULL,
  confidence REAL NOT NULL,
  method TEXT NOT NULL,
  version TEXT,
  created_at TEXT,
  PRIMARY KEY (review_id, method, version),
  FOREIGN KEY (review_id) REFERENCES review(id)
);

CREATE TABLE IF NOT EXISTS node_review_stats (
  node_id INTEGER PRIMARY KEY,
  review_count INTEGER NOT NULL,
  sentiment_sum REAL NOT NULL,
  sentiment_avg REAL NOT NULL,
  bayes_score REAL NOT NULL,
  weighted_count REAL,
  weighted_sentiment_sum REAL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_node_review_stats_review_count
  ON node_review_stats (review_count DESC);
CREATE INDEX IF NOT EXISTS idx_node_review_stats_bayes_score
  ON node_review_stats (bayes_score DESC);
