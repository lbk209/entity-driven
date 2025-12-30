# Work With Codex (Entity Reviews)

This file captures context so we can continue quickly next time.

## Project Summary

Minimal Next.js App Router app with SQLite for local testing. Features:
- Create users
- Submit and edit reviews linked to entities (inline creation supported)
- Filter reviews by linked entity name terms
- Review previews show first 1-2 sentences

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
  - `app/api/edges/route.ts`
- Frontend UI: `app/page.tsx`, `app/reviews/new/page.tsx`, `app/reviews/[id]/page.tsx`, `app/reviews/[id]/edit/page.tsx`
- Shared review form: `app/reviews/ReviewForm.tsx`
- Admin UI: `app/edges/admin/page.tsx`
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
- Review list shows real user IDs, two-line layout, and entity badges.
- Entity picker uses inline chips, autocomplete suggestions, and a collapse toggle.
- Review details show entity badges before content with an edit action.
- Schema now uses `nodes` (id, name, type; unique on name+type) and `edges` (parent, child, relation).
- Admin page for nodes/edges management at `/edges/admin`.
- Notebook for data review: `review_app_sqlite.ipynb`.

## Schema

```
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
  FOREIGN KEY(parent_id) REFERENCES nodes(id),
  FOREIGN KEY(child_id) REFERENCES nodes(id)
);
```

## Next Ideas

- Add basic validation messages on the client.
- Add node type input to the review form if needed.
- Add simple tests for API routes.
