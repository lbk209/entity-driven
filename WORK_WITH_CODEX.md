# Work With Codex (Entity Reviews)

This file captures context so we can continue quickly next time.

## Project Summary

Minimal Next.js App Router app with SQLite for local testing. Features:
- Create users
- Submit and edit reviews linked to entities (inline creation supported)
- Filter reviews by linked entity name terms
- Review previews use full content; entity badges are inline and mobile clamps to two lines

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
  - `app/api/user/route.ts`
  - `app/api/review/route.ts`
  - `app/api/reviews/route.ts`
  - `app/api/entities/route.ts`
  - `app/api/nodes/route.ts`
  - `app/api/nodes/merge/route.ts`
  - `app/api/edges/route.ts`
  - `app/api/aliases/route.ts`
- Frontend UI: `app/page.tsx`, `app/reviews/new/page.tsx`, `app/reviews/[id]/page.tsx`, `app/reviews/[id]/edit/page.tsx`
- Shared review form: `app/reviews/ReviewForm.tsx`
- Admin UI: `app/admin/page.tsx`
- Styles: `app/globals.css`

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
- Review updates record `updated_at` and list sorting uses updated time.
- Review list shows real user IDs, entity badges, and uses a snap-scrolling list without a section header.
- Entity picker uses inline chips, autocomplete suggestions, and a collapse toggle.
- Review details show entity badges before content with an edit action.
- Schema now uses canonical `nodes`, `entity_aliases`, and `review_entity.alias`.
- Search/filter resolves via `entity_aliases` and filters on `review_entity.node_id` only.
- Admin page for nodes/edges/aliases management at `/admin` with merge workflow.
- Review edit supports delete with user/password confirmation.
- Notebook for data review: `review_app_sqlite.ipynb`.
- Admin page behavior: tabs for nodes/edges/aliases are a minimal underline style, tabs + active form/search live in a fixed header, edit/insert forms replace the search/insert row, list rows scroll/snap in their own panel, delete requires confirm (stronger if referenced), edit can switch by clicking another row, rows truncate long values for alignment, and edge list columns now keep parent/child widths consistent.
- Admin nodes: search filter supports field selection; insert forms keep open after save; draft selects show gray placeholder text; edit cancel buttons are last in row; node type inputs use inline suggestions populated from existing types.
- Admin aliases: search filter supports alias/node selection; insert forms keep open after save; draft node select uses a placeholder.
- Admin edges: search filter supports parent/child/relation selection; insert forms keep open after save; draft parent/child/relation selects use placeholders.
- Entity Reviews filter: search uses a custom suggestion dropdown with max-height styling; suggestions show on focus and filter as you type.

## Schema

```
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

CREATE TABLE IF NOT EXISTS edges (
  parent_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  UNIQUE(parent_id, child_id, relation),
  FOREIGN KEY(parent_id) REFERENCES nodes(id),
  FOREIGN KEY(child_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS review_entity (
  review_id INTEGER NOT NULL,
  node_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  PRIMARY KEY (review_id, node_id),
  FOREIGN KEY (review_id) REFERENCES review(id),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
```

## Quick Context (No File Reads Needed)

- Admin UI path: `/admin`
- Tables: `user`, `review`, `nodes`, `entity_aliases`, `edges`, `review_entity`
- Nodes/edges/aliases use the same inline form layout as insert, with Update/Cancel/Delete
- Delete confirmation always appears; if referenced by reviews/edges/aliases, message is stronger
- Merge nodes reassigns aliases, reviews, and edges in a single transaction
- Clicking a different row replaces the current edit form

## Next Ideas

- Add basic validation messages on the client.
- Add node type input to the review form if needed.
- Add simple tests for API routes.
