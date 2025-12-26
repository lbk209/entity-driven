# Entity Reviews (SQLite + Next.js)

Minimal Next.js App Router app for local testing with SQLite. Supports creating users, submitting reviews linked to entities, and filtering reviews by linked entities.

## Requirements

- Node.js 18+
- npm

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API Routes

- `POST /api/user`
  - Body: `{ "user_id": "alice", "password": "secret" }`
- `POST /api/review`
  - Body: `{ "user_id": "alice", "password": "secret", "content": "...", "entities": [{"name":"Payments"}] }`
- `GET /api/reviews`
  - Optional query: `?entity=NAME`
- `GET /api/entities`

## Database

SQLite file is created at `data/app.sqlite` on first API call. Schema is in `lib/schema.sql` and initialized by `lib/db.ts`.

## Notes

- Plain-text passwords are used (local testing only).
- Review previews show only the first 1–2 sentences.
- Filtering is by linked entity name only.
