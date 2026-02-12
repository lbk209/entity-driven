# Work With Codex (Entity Reviews)

This file captures context so we can continue quickly next time.

## Project Summary

Minimal Next.js App Router app with SQLite for local testing. Features:
- Create users
- Submit and edit reviews linked to entities (inline creation supported)
- Filter reviews by entity_id, taxonomy label, and user context (`scope`/`user_id` normalized to one effective user filter); review content search is local when an entity is selected
- Review details are entity-scoped only (no standalone canonical detail page); deep-link focus uses `/entity-reviews?...&review=<id>`
- Review previews use full content; expanded review text renders as one continuous inline flow (preview slice + remainder)
- Entity badges are inline and mobile clamps to two lines
- Expanded reviews support inline author-only edit/delete with a strict read-vs-edit state machine
- Top Entities page at `/top-entities` with local, commit-based list search (name or keywords), taxonomy label filters, and sortable columns
- Entity Reviews and Top Entities use cursor-based incremental loading with fixed page sizes and max caps

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
  - `app/api/reviews/user-summary/route.ts`
  - `app/api/entities/route.ts`
  - `app/api/node-type/route.ts`
  - `app/api/taxonomy/route.ts`
  - `app/api/node-taxonomy/route.ts`
  - `app/api/nodes/route.ts`
  - `app/api/nodes/merge/route.ts`
  - `app/api/edges/route.ts`
  - `app/api/node-review-stats/route.ts`
- Frontend UI: `app/page.tsx`, `app/reviews/new/page.tsx`, `app/reviews/[id]/edit/page.tsx`
- Legacy review-entry redirect: `app/reviews/[id]/route.ts`
- Entity Reviews UI: `app/entity-reviews/EntityReviewsClient.tsx`, `app/components/UserSummaryRow.tsx`
- Shared entity input: `app/components/ReviewEntityInput.tsx`
- Top Entities UI: `app/top-entities/page.tsx`
- Legacy redirect: `app/node-review-stats/page.tsx`
- Shared review form: `app/reviews/ReviewForm.tsx`
- Admin UI: `app/admin/page.tsx`
- Styles: `app/globals.css`

## API (Cursor Pagination)

- Entity Reviews: `GET /api/reviews` supports `cursor_created_at` + `cursor_review_id`; response includes `nextCursor` with `{ created_at, review_id }`.
- User summary panel: `GET /api/reviews/user-summary` supports `user_id` and optional `entity_id` for per-user panel stats.
- Top Entities: `GET /api/node-review-stats` supports `cursor_score`, `cursor_count`, `cursor_node_id`, plus `cursor_name` when sorting by name; response includes `nextCursor` with `{ score, count, node_id, name }` and keyword fields (`pos_keywords`, `neg_keywords`).

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
- Login redirect enforces role-aware default scope on success: users land with `scope=my`, admins with `scope=all`.
- Logout forces `scope=all` in the URL.
- Review updates record `updated_at` and list sorting uses updated time.
- Entity Reviews list is cursor-paginated and sorted by `created_at DESC, id DESC` with `(created_at, review_id)` cursor.
- Top Entities list is cursor-paginated with `(score, count, node_id)` cursor; sorting is frozen during scrolling and resets on sort/filter changes.
- Review list shows real user IDs, entity badges, and uses a snap-scrolling list without a section header.
- Entity picker uses autocomplete suggestions and commits by entity_id only.
- `/reviews/[id]` is treated as a legacy entry point only; it redirects to `/entity-reviews` with `review` and (when available) `entity_id`.
- Reviews store `entity_name` directly with optional `entity_id` (resolved vs unresolved reviews).
- Search/filter uses `review.entity_id` for entity filtering, plus taxonomy labels and user IDs. Review-content search is local (client-side) when an entity is selected.
- Entity Reviews URL `review` param controls expand/scroll only; only one review can be expanded at a time.
- Expanding a review never enters edit mode automatically. Edit is explicit and single-review only.
- Write review now opens an inline draft row at the top of Entity Reviews (no route change to `/reviews/new` for this primary flow).
- Single active session rule is enforced in Entity Reviews: `draftReview` and `editingReviewId` are mutually exclusive; creating a draft clears active edit/expand and ignores URL `?review=` until draft is cleared.
- Draft create context rules: when `entity_id` is active, draft initializes with that entity and disables entity editing; clicking Write review removes URL `user_id` via `router.replace` while preserving `scope`/`entity_id`.
- Draft save is wired to `POST /api/review` (no refetch): on success, draft is cleared, new review is prepended locally (entity-filter match required), and the new review is expanded; on failure, draft remains open with inline error state.
- Client create normalization is defensive because `POST /api/review` currently returns `{ id }` in this repo: prepend falls back to draft/session values for `content`, `entity_*`, `user_id`, and `created_at` to keep list shape safe.
- Expand scroll behavior is stabilized for real reviews: expansion uses top-delta correction (`requestAnimationFrame` + `window.scrollBy({ behavior: 'auto' })`) to prevent jump from height changes; collapse keeps default behavior.
- Draft creation auto-scrolls into view using centered positioning for usability on long lists.
- Inline review edit/delete lives in expanded rows (author-only controls). Edit mode uses full `review.content` in one textarea.
- Inline edit now reuses the shared review-create entity input (`ReviewEntityInput`) so entity autocomplete/selection semantics are identical across create and edit.
- Inline edit entity rules are mode-gated: entity editing is enabled only with no `entity_id` in URL; when `entity_id` context is active, the inline entity control remains visible but disabled.
- Inline edit session persists both review text and entity fields (`entity_id` / `entity_name`) on Save; Cancel discards both content and entity draft state.
- Expanded read-only author controls show `Edit` only; `Delete` is intentionally available only after entering edit mode.
- Inline edit layout order is fixed as: entity input + actions row, then review textarea, then footer meta row.
- Entity input UI no longer shows a static visible `Entity` label in create/inline-edit wrappers; accessibility labels are provided via `aria-label`.
- `ReviewEntityInput` is now always a real input in create and inline edit (no selected/display split, no click-to-enter-edit transition logic).
- Entity mutability is enforced only via `disabled` in entity-context mode (`entity_id` in URL); suggestion behavior remains unchanged.
- Entity input styling is intentionally plain input styling (badge-like edit styling experiment removed).
- Inline edit controls are simplified: base `.review-control-button` is neutral (white background, gray border), `--ghost` is removed, and `--danger` uses red text on a neutral background.
- Delete flow hardening: duplicate-click prevention includes an in-flight guard, and failure paths always clear loading state.
- Review text interaction uses a single clickable content container (preview + remainder) so expanded text has no dead click zones.
- Review text visual style is intentionally neutral: no selection background/underline; pointer cursor is the primary interaction cue.
- Shared row spacing uses `.list-row` (column + gap) across Entity Reviews and Top Entities for consistent first/second-line spacing.
- Entity Reviews URL supports `entity_id` and `user_id` (no `user_name`); `user_id` deep links open the User Info Panel and filter the list.
- Entity Reviews has two context panels: Entity Info and User Info. In `scope=my`, User Info is always shown first and non-closable; in `scope=all`, Entity Info renders first (if present) and User Info is closable.
- User Info panel key entities are displayed as plain names (`A, B`) without the `Top entities:` prefix or inline count text.
- Entity Reviews normalizes user context to a single `effectiveUserId`: `scope=my` uses session user and ignores URL `user_id`; otherwise URL `user_id` is used.
- Entity Reviews review fetches are normalized client-side: `scope`/`user_id` are stripped from review query params and the effective user filter is sent via `x-review-user-id`.
- Any scope transition (`all` ↔ `my`, including set/unset) clears `user_id` from the URL while preserving other params such as `entity_id`.
- Verification status: backend user-summary flow matches intended design (`/api/reviews/user-summary` with required `user_id`, optional `entity_id`, and stable panel data independent of list pagination/order/search).
- Open behavior note: user filter can be removed by scope transition (URL `user_id` is cleared), so removal is not exclusively via the User Info panel close action.
- Entity Reviews entity filter UX: `entity_id=ID` deep links populate the entity selector when resolvable; clearing entity context removes only `entity_id`.
- Top Entities row click navigates to Entity Reviews with `scope` and `entity_id` preserved in the URL.
- Top Entities list includes per-node positive/negative keyword strings from `node_review_keywords` (versioned via `NODE_REVIEW_KEYWORD_VERSION`).
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
- Filter semantics are centralized in `lib/reviewFilters.ts` and consumed by APIs/UI: URL parsing includes `user_id`, and Entity Reviews derives an `effectiveUserId` to avoid duplicate `scope=my` + `user_id=<me>` meaning in downstream filtering/panels.

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
  entity_id INTEGER,
  entity_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (entity_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS user_session (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
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

CREATE TABLE IF NOT EXISTS node_review_keywords (
  node_id INTEGER NOT NULL,
  polarity TEXT NOT NULL,
  keyword TEXT NOT NULL,
  score REAL NOT NULL,
  rank INTEGER NOT NULL,
  version TEXT NOT NULL,
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
- Tables: `user`, `review`, `user_session`, `review_sentiment`, `node_review_stats`, `node_review_keywords`, `nodes`, `edges`, `edge_relations`, `node_type`, `taxonomy`, `node_taxonomy`
- Nodes/edges use the same inline form layout as insert, with Update/Cancel/Delete.
- Delete confirmation always appears; if referenced by reviews/edges, message is stronger
- Merge nodes reassigns reviews and edges in a single transaction
- Clicking a different row replaces the current edit form

## Next Ideas

- Add basic validation messages on the client.
- Add node type input to the review form if needed.
- Add simple tests for API routes.
