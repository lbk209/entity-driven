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

CREATE TABLE IF NOT EXISTS edge_relations (
  relation TEXT PRIMARY KEY,
  description TEXT,
  ui_priority INTEGER,
  max_suggestions INTEGER,
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
  const hasNodeTypePrior = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='node_type_prior'")
    .get() as { name?: string } | undefined;
  const hasNodeType = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='node_type'")
    .get() as { name?: string } | undefined;
  if (hasNodeTypePrior?.name) {
    if (!hasNodeType?.name) {
      db.exec('ALTER TABLE node_type_prior RENAME TO node_type;');
    } else {
      db.exec(`
        INSERT OR IGNORE INTO node_type (node_type, description)
        SELECT node_type, description FROM node_type_prior;
        DROP TABLE node_type_prior;
      `);
    }
  }
  const nodeTypeColumns = db
    .prepare("PRAGMA table_info('node_type')")
    .all() as Array<{ name: string }>;
  const nodeTypeHasBasePrior = nodeTypeColumns.some((column) => column.name === 'base_prior');
  const nodeTypeHasUpdatedAt = nodeTypeColumns.some((column) => column.name === 'updated_at');
  if (nodeTypeHasBasePrior || nodeTypeHasUpdatedAt) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      ALTER TABLE node_type RENAME TO node_type_old;
      CREATE TABLE node_type (
        node_type TEXT PRIMARY KEY,
        description TEXT
      );
      INSERT INTO node_type (node_type, description)
      SELECT node_type, description FROM node_type_old;
      DROP TABLE node_type_old;
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }
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
  const hasUiPriority = edgeRelationColumns.some((column) => column.name === 'ui_priority');
  const hasMaxSuggestions = edgeRelationColumns.some((column) => column.name === 'max_suggestions');
  const hasLegacyTransitive = edgeRelationColumns.some(
    (column) => column.name === 'is_transitive'
  );
  const hasLegacyWeight = edgeRelationColumns.some(
    (column) => column.name === 'default_weight'
  );
  const shouldRebuildEdgeRelations =
    hasLegacyTransitive ||
    hasLegacyWeight ||
    !hasUiPriority ||
    !hasMaxSuggestions ||
    !hasAllowedParentTypes ||
    !hasAllowedChildTypes ||
    !hasDescription;
  if (shouldRebuildEdgeRelations) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      ALTER TABLE edge_relations RENAME TO edge_relations_old;
      CREATE TABLE edge_relations (
        relation TEXT PRIMARY KEY,
        description TEXT,
        ui_priority INTEGER,
        max_suggestions INTEGER,
        allowed_parent_types TEXT NOT NULL,
        allowed_child_types TEXT NOT NULL
      );
      INSERT INTO edge_relations (
        relation,
        description,
        ui_priority,
        max_suggestions,
        allowed_parent_types,
        allowed_child_types
      )
      SELECT
        relation,
        description,
        NULL,
        NULL,
        COALESCE(allowed_parent_types, '[]'),
        COALESCE(allowed_child_types, '[]')
      FROM edge_relations_old;
      DROP TABLE edge_relations_old;
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }
  const hasNodes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'")
    .get() as { name?: string } | undefined;
  if (hasNodes?.name) {
    const nodeColumns = db
      .prepare("PRAGMA table_info('nodes')")
      .all() as Array<{ name: string }>;
    const nodeHasDescription = nodeColumns.some((column) => column.name === 'description');
    const nodeHasIsActive = nodeColumns.some((column) => column.name === 'is_active');
    const nodeHasCreatedAt = nodeColumns.some((column) => column.name === 'created_at');
    const nodeHasUpdatedAt = nodeColumns.some((column) => column.name === 'updated_at');
    const needsNodeTypeFk = !hasForeignKey(db, 'nodes', 'type', 'node_type', 'node_type');
    if (needsNodeTypeFk) {
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec(`
        ALTER TABLE nodes RENAME TO nodes_old;
        CREATE TABLE nodes (
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
        INSERT INTO nodes (
          id,
          name,
          type,
          description,
          is_active,
          created_at,
          updated_at
        )
        SELECT
          id,
          name,
          type,
          ${nodeHasDescription ? 'description' : 'NULL'},
          ${nodeHasIsActive ? 'is_active' : '1'},
          ${nodeHasCreatedAt ? 'created_at' : "datetime('now')"},
          ${nodeHasUpdatedAt ? 'updated_at' : "datetime('now')"}
        FROM nodes_old;
        DROP TABLE nodes_old;
      `);
      db.exec('PRAGMA foreign_keys = ON');
    } else {
      if (!nodeHasDescription) {
        db.exec('ALTER TABLE nodes ADD COLUMN description TEXT;');
      }
      if (!nodeHasIsActive) {
        db.exec('ALTER TABLE nodes ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
      }
      if (!nodeHasCreatedAt) {
        db.exec('ALTER TABLE nodes ADD COLUMN created_at TEXT;');
      }
      if (!nodeHasUpdatedAt) {
        db.exec('ALTER TABLE nodes ADD COLUMN updated_at TEXT;');
      }
    }
  } else {
    db.exec(`
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
    INSERT OR IGNORE INTO node_type (node_type, description)
    SELECT DISTINCT type, NULL FROM nodes;
  `);
  const allowedTypes = db
    .prepare(
      `
      SELECT DISTINCT type AS value FROM nodes
      UNION
      SELECT DISTINCT node_type AS value FROM node_type
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
        description,
        ui_priority,
        max_suggestions,
        allowed_parent_types,
        allowed_child_types
      )
      SELECT DISTINCT relation, NULL, NULL, NULL, ?, ? FROM edges;
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
      'Indicates structural, spatial, or conceptual inclusion where one entity fully contains another.',
    sells:
      'Indicates a direct sales relationship where a vendor, restaurant, or venue sells a specific product or menu item.',
    operates:
      'Indicates that a brand operates or manages a specific vendor, restaurant, or venue. This does not imply direct sales by the brand itself.',
    produces:
      'Indicates that a brand manufactures or creates a product or menu item, independent of where it is sold.',
    located_in:
      'Indicates the physical location of an entity within a geographic area.'
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
  const reviewEntityExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='review_entity'")
    .get() as { name?: string } | undefined;
  const reviewEntitySentimentExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='review_entity_sentiment'"
    )
    .get() as { name?: string } | undefined;
  const reviewSentimentExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='review_sentiment'")
    .get() as { name?: string } | undefined;
  db.exec('DROP TRIGGER IF EXISTS nodes_self_alias;');
  db.exec('DROP TABLE IF EXISTS entity_aliases;');
  db.exec('DROP TABLE IF EXISTS entity;');
  const reviewColumns = db.prepare("PRAGMA table_info('review')").all() as Array<{
    name: string;
  }>;
  const reviewHasEntityName = reviewColumns.some((column) => column.name === 'entity_name');
  const reviewHasNodeId = reviewColumns.some((column) => column.name === 'node_id');
  const hasUpdatedAt = reviewColumns.some((column) => column.name === 'updated_at');
  const needsReviewRebuild =
    !reviewHasEntityName ||
    !reviewHasNodeId ||
    !hasForeignKey(db, 'review', 'node_id', 'nodes', 'id');
  if (needsReviewRebuild) {
    const reviewEntityNameExpr = reviewHasEntityName
      ? "COALESCE(r.entity_name, re.alias, '')"
      : "COALESCE(re.alias, '')";
    const reviewNodeIdExpr = reviewHasNodeId ? 'r.node_id' : 're.node_id';
    const reviewEntityJoin = reviewEntityExists?.name
      ? 'LEFT JOIN review_entity re ON r.id = re.review_id'
      : '';
    const reviewEntityNameValue = reviewEntityExists?.name
      ? reviewEntityNameExpr
      : reviewHasEntityName
        ? 'r.entity_name'
        : "''";
    const reviewNodeIdValue = reviewEntityExists?.name
      ? reviewNodeIdExpr
      : reviewHasNodeId
        ? 'r.node_id'
        : 'NULL';
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      ALTER TABLE review RENAME TO review_old;
      CREATE TABLE review (
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
      INSERT INTO review (id, user_id, content, node_id, entity_name, created_at, updated_at)
      SELECT
        r.id,
        r.user_id,
        r.content,
        ${reviewNodeIdValue},
        ${reviewEntityNameValue},
        r.created_at,
        r.updated_at
      FROM review_old r
      ${reviewEntityJoin};
      DROP TABLE review_old;
    `);
    db.exec('PRAGMA foreign_keys = ON');
  } else {
    if (!hasUpdatedAt) {
      db.exec('ALTER TABLE review ADD COLUMN updated_at TEXT');
    }
    if (reviewEntityExists?.name) {
      db.exec(`
        UPDATE review
        SET node_id = COALESCE(
              node_id,
              (SELECT node_id FROM review_entity re WHERE re.review_id = review.id)
            ),
            entity_name = CASE
              WHEN entity_name IS NULL OR entity_name = ''
                THEN COALESCE(
                  (SELECT alias FROM review_entity re WHERE re.review_id = review.id),
                  entity_name,
                  ''
                )
              ELSE entity_name
            END
        WHERE EXISTS (SELECT 1 FROM review_entity re WHERE re.review_id = review.id);
      `);
    }
  }
  const migrateReviewSentiment = (sourceTable: 'review_entity_sentiment' | 'review_sentiment') => {
    if (!reviewEntityExists?.name) {
      throw new Error('review_entity missing for sentiment migration');
    }
    const sourceTableName = sourceTable === 'review_sentiment' ? 'review_sentiment_old' : sourceTable;
    if (sourceTable === 'review_sentiment') {
      db.exec('ALTER TABLE review_sentiment RENAME TO review_sentiment_old;');
    } else {
      db.exec('ALTER TABLE review_entity_sentiment RENAME TO review_sentiment_old;');
    }
    db.exec(`
      CREATE TABLE review_sentiment (
        review_id INTEGER NOT NULL,
        sentiment_raw REAL NOT NULL,
        confidence REAL NOT NULL,
        method TEXT NOT NULL,
        version TEXT,
        created_at TEXT,
        PRIMARY KEY (review_id, method, version),
        FOREIGN KEY (review_id) REFERENCES review(id)
      );
      INSERT INTO review_sentiment (
        review_id,
        sentiment_raw,
        confidence,
        method,
        version,
        created_at
      )
      SELECT
        re.review_id,
        res.sentiment_raw,
        res.confidence,
        res.method,
        res.version,
        res.created_at
      FROM ${sourceTableName} res
      JOIN review_entity re ON re.id = res.review_entity_id;
      DROP TABLE ${sourceTableName};
    `);
  };
  if (reviewEntitySentimentExists?.name) {
    migrateReviewSentiment('review_entity_sentiment');
  } else if (reviewSentimentExists?.name) {
    const reviewSentimentColumns = db
      .prepare("PRAGMA table_info('review_sentiment')")
      .all() as Array<{ name: string }>;
    const reviewSentimentHasReviewEntityId = reviewSentimentColumns.some(
      (column) => column.name === 'review_entity_id'
    );
    if (reviewSentimentHasReviewEntityId) {
      migrateReviewSentiment('review_sentiment');
    }
  }
  db.exec('DROP TABLE IF EXISTS review_entity;');
  return db;
}

export function previewText(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, ' ');
}
