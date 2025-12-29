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
- Frontend UI: `app/page.tsx`, `app/reviews/new/page.tsx`, `app/reviews/[id]/page.tsx`, `app/reviews/[id]/edit/page.tsx`
- Shared review form: `app/reviews/ReviewForm.tsx`
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
- Notebook for data review: `review_app_sqlite.ipynb`.

## Next Ideas

- Add basic validation messages on the client.
- Add entity metadata fields (type, level, parent) in the review form if needed.
- Add simple tests for API routes.
