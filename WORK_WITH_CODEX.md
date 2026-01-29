# Work With Codex (Entity Reviews)

This file captures context so we can continue quickly next time.

## Project Summary

Minimal Next.js App Router app with SQLite for local testing. Features:
- Create users
- Submit and edit reviews linked to entities (inline creation supported)
- Filter reviews by linked node name/id, taxonomy label, and user id (via scope or specific user filter)
- Review previews use full content; entity badges are inline and mobile clamps to two lines
- Node review stats page at `/node-review-stats` with server-side node-name search, taxonomy label filters, and sortable columns
- Entity Reviews and Node Review Stats use cursor-based incremental loading with fixed page sizes and max caps

## Stack

- Next.js (App Router)
- React
- Node.js runtime
- SQLite via better-sqlite3
- No ORM, no external auth

## Key Files

- SQLite init + preview helper: `lib/db.ts`
- Schema reference: `lib/schema.sql`
- API routes:
  - `app/api/admin/reviews/route.ts`
  - `app/api/edge-relations/route.ts`
  - `app/api/user/route.ts`
  - `app/api/review/route.ts`
  - `app/api/reviews/route.ts`
  - `app/api/entities/route.ts`
  - `app/api/node-type/route.ts`
  - `app/api/taxonomy/route.ts`
  - `app/api/node-taxonomy/route.ts`
  - `app/api/nodes/route.ts`
  - `app/api/nodes/merge/route.ts`
  - `app/api/edges/route.ts`
  - `app/api/node-review-stats/route.ts`
- Frontend UI: `app/page.tsx`, `app/reviews/new/page.tsx`, `app/reviews/[id]/page.tsx`, `app/reviews/[id]/edit/page.tsx`
- Node review stats UI: `app/node-review-stats/page.tsx`
- Shared review form: `app/reviews/ReviewForm.tsx`
- Admin UI: `app/admin/page.tsx`
- Styles: `app/globals.css`

## API (Cursor Pagination)

- Entity Reviews: `GET /api/reviews` supports `cursor_created_at` + `cursor_review_id`; response includes `nextCursor` with `{ created_at, review_id }`.
- Node Review Stats: `GET /api/node-review-stats` supports `cursor_score`, `cursor_count`, `cursor_node_id`, plus `cursor_name` when sorting by name; response includes `nextCursor` with `{ score, count, node_id, name }`.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Git

Remote: `https://github.com/lbk209/entity-driven`

The repository was pushed after cleaning history to remove `node_modules` and build artifacts.

## Notes

- SQLite file is created at `data/app.sqlite` on first API call.
- `.gitignore` excludes `node_modules/`, `.next/`, `.next.bak/`, and `data/app.sqlite`.
- Passwords are plain text (testing only).
- Login redirect enforces role-aware default scope on success: users land with `scope=my`, admins with `scope=all`; when scope becomes `my`, node-related params (`node`, `node_id`, `node_name`) are stripped.
- Logout forces `scope=all` in the URL.
- Review updates record `updated_at` and list sorting uses updated time.
- Entity Reviews list is cursor-paginated and sorted by `created_at DESC, id DESC` with `(created_at, review_id)` cursor.
- Node Review Stats list is cursor-paginated with `(score, count, node_id)` cursor; sorting is frozen during scrolling and resets on sort/filter changes.
- Review list shows real user IDs, entity badges, and uses a snap-scrolling list without a section header.
- Entity picker uses autocomplete suggestions and stores the exact user-entered name.
- Review details show the entity badge before content with an edit action.
- Reviews store `entity_name` directly with an optional `node_id` anchor.
- Search/filter resolves via `nodes.name`/`review.node_id`, plus taxonomy labels and user IDs.
- Entity Reviews API accepts `node` (id), `node_name` (name), `label`, and a specific user filter via `x-review-user-id` header.
- Entity Reviews node filter UX: `node=ID` deep links resolve to node name and populate the node name search box; the clear button removes `node`, `node_id`, `node_name`, and any specific user filter.
- Entity Reviews user filter UX: clicking a user name filters reviews to that user while scope remains `all`; the search clear button clears the user filter and node-name search, and node search placeholder changes to “Click Clear first” while active.
- Node Review Stats row click navigates to Entity Reviews with `scope` and `node` preserved in the URL.
- Badge semantics are intentionally split:
  - Entity Reviews badges are review-driven (counts = review totals per taxonomy).
  - Node Review Stats badges are node-driven (counts = distinct reviewed nodes per taxonomy).
- Admin page for nodes/edges/taxonomy/reviews/reference management at `/admin` with merge workflow.
- Review edit supports delete with user/password confirmation.
- Notebook for data review: `review_app_sqlite.ipynb`.
- Admin page behavior: tabs for nodes/edges/taxonomy/reviews/reference are a minimal underline style, tabs + active form/search live in a fixed header, edit/insert forms replace the search/insert row, list rows scroll/snap in their own panel, delete requires confirm (stronger if referenced), edit can switch by clicking another row, rows truncate long values for alignment, and edge list columns now keep parent/child widths consistent.
- Admin nodes: search filter supports field selection; insert forms keep open after save; draft selects show gray placeholder text; edit cancel buttons are last in row; node type inputs use inline suggestions populated from existing types.
- Admin edges: search filter supports parent/child/relation selection plus related traversal; insert forms keep open after save; draft parent/child/relation selects use placeholders.
- Edge relations include allowed parent/child node type lists stored as JSON strings, plus description, UI priority, and max suggestions; edge inserts/updates validate parent/child node types against these lists.
- Admin Reference tab uses radio buttons to switch between edge relations, node types, and taxonomy views; relation list wraps parent/child types and vertically centers row text; relation edit row supports multi-select type pickers and shows the relation description in a compact textarea below the form row.
- Entity Reviews filter: node search uses a custom suggestion dropdown with max-height styling; suggestions show on focus and filter as you type; label badges and user-id filtering are supported.
- Pagination limits live in `lib/constants.ts` as `ENTITY_REVIEWS_PAGE_SIZE`, `ENTITY_REVIEWS_MAX_ITEMS`, `NODE_REVIEW_STATS_PAGE_SIZE`, and `NODE_REVIEW_STATS_MAX_ITEMS`.
- Filter semantics are centralized in `interpretReviewFilters` (`lib/reviewFilters.ts`): scope `my` is mutually exclusive with a specific user (default policy ignores the specific user when `scope=my`), while `scope=all` may be combined with a specific user; SQL consumes only the interpreted filter object.

## Schema

```
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
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
  FOREIGN KEY(parent_id) REFERENCES nodes(id),
  FOREIGN KEY(child_id) REFERENCES nodes(id),
  FOREIGN KEY(relation) REFERENCES edge_relations(relation)
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
```

## Quick Context (No File Reads Needed)

- Admin UI path: `/admin`
- Tables: `user`, `review`, `review_sentiment`, `node_review_stats`, `nodes`, `edges`, `edge_relations`, `node_type`, `taxonomy`, `node_taxonomy`
- Nodes/edges use the same inline form layout as insert, with Update/Cancel/Delete.
- Delete confirmation always appears; if referenced by reviews/edges, message is stronger
- Merge nodes reassigns reviews and edges in a single transaction
- Clicking a different row replaces the current edit form

## Next Ideas

- Add basic validation messages on the client.
- Add node type input to the review form if needed.
- Add simple tests for API routes.
