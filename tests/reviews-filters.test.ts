import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

process.env.DB_PATH = 'test.sqlite';

const dbPath = path.join(process.cwd(), 'data', process.env.DB_PATH);
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

import { getDb } from '../lib/db';

globalThis.AsyncLocalStorage = AsyncLocalStorage;

const { GET: getReviews } = await import('../app/api/reviews/route');
const { requestAsyncStorage } = await import(
  'next/dist/client/components/request-async-storage.external'
);
const { DraftModeProvider } = await import('next/dist/server/async-storage/draft-mode-provider');
const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers');
const { RequestCookiesAdapter } = await import(
  'next/dist/server/web/spec-extension/adapters/request-cookies'
);
const { RequestCookies, ResponseCookies } = await import(
  'next/dist/server/web/spec-extension/cookies'
);

const db = getDb();

function resetDb() {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    DELETE FROM review_sentiment;
    DELETE FROM node_review_stats;
    DELETE FROM edges;
    DELETE FROM edge_relations;
    DELETE FROM node_taxonomy;
    DELETE FROM taxonomy;
    DELETE FROM review;
    DELETE FROM user_session;
    DELETE FROM nodes;
    DELETE FROM node_type;
    DELETE FROM user;
    DELETE FROM sqlite_sequence;
  `);
  db.exec('PRAGMA foreign_keys = ON;');
}

function seedData() {
  db.prepare('INSERT INTO user (id, user_id, password, role) VALUES (?, ?, ?, ?)').run(
    1,
    'user_a',
    'pw',
    'user'
  );
  db.prepare('INSERT INTO user (id, user_id, password, role) VALUES (?, ?, ?, ?)').run(
    2,
    'user_b',
    'pw',
    'user'
  );

  db.prepare('INSERT INTO node_type (node_type, description) VALUES (?, ?)').run(
    'product',
    null
  );
  db.prepare('INSERT INTO nodes (id, name, type) VALUES (?, ?, ?)').run(1, 'Alpha', 'product');
  db.prepare('INSERT INTO nodes (id, name, type) VALUES (?, ?, ?)').run(2, 'Beta Product', 'product');

  db.prepare(
    'INSERT INTO taxonomy (id, key, value, node_type, label, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(1, 'kind', 'one', 'product', 'LabelOne', null);
  db.prepare(
    'INSERT INTO taxonomy (id, key, value, node_type, label, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(2, 'kind', 'two', 'product', 'LabelTwo', null);

  db.prepare('INSERT INTO node_taxonomy (node_id, taxonomy_id) VALUES (?, ?)').run(1, 1);
  db.prepare('INSERT INTO node_taxonomy (node_id, taxonomy_id) VALUES (?, ?)').run(2, 2);

  db.prepare(
    `INSERT INTO review (id, user_id, content, node_id, entity_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(1, 1, 'A', 1, 'Alpha', '2025-01-01T00:00:00Z', null);
  db.prepare(
    `INSERT INTO review (id, user_id, content, node_id, entity_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(2, 1, 'B', 2, 'Beta Product', '2025-01-02T00:00:00Z', null);
  db.prepare(
    `INSERT INTO review (id, user_id, content, node_id, entity_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(3, 2, 'C', 1, 'Alpha', '2025-01-03T00:00:00Z', null);
  db.prepare(
    `INSERT INTO review (id, user_id, content, node_id, entity_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(4, 2, 'D', 2, 'Beta Product', '2025-01-04T00:00:00Z', null);
}

function createSessionCookie(userDbId: number) {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO user_session (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(token, userDbId, now, expires);
  return token;
}

async function fetchReviews(options: {
  query?: string;
  headerUserId?: string;
  sessionUserId?: number;
}) {
  const query = options.query ? `?${options.query}` : '';
  const headers = new Headers();
  if (options.headerUserId) {
    headers.set('x-review-user-id', options.headerUserId);
  }
  if (options.sessionUserId) {
    const token = createSessionCookie(options.sessionUserId);
    // Session cookie name is defined in lib/auth.ts (SESSION_COOKIE).
    headers.set('cookie', `review_session=${token}`);
  }
  const requestCookies = new RequestCookies(headers);
  const sealedCookies = RequestCookiesAdapter.seal(requestCookies);
  const mutableCookies = new ResponseCookies(new Headers());
  const draftMode = new DraftModeProvider(null, null, sealedCookies, mutableCookies);
  const store = {
    headers: HeadersAdapter.seal(headers),
    cookies: sealedCookies,
    mutableCookies,
    draftMode,
    reactLoadableManifest: {},
    assetPrefix: ''
  };

  const response = await requestAsyncStorage.run(store, () =>
    getReviews(new Request(`http://localhost/api/reviews${query}`, { headers }))
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  return data.reviews as Array<{ id: number; user_id: string }>;
}

test('reviews filters with specific user combinations', async () => {
  resetDb();
  seedData();

  const caseA = await fetchReviews({ query: 'label=LabelOne', headerUserId: 'user_a' });
  assert.deepEqual(caseA.map((row) => row.id).sort(), [1]);

  const caseB = await fetchReviews({ query: 'node=2', headerUserId: 'user_a' });
  assert.deepEqual(caseB.map((row) => row.id).sort(), [2]);

  const caseC = await fetchReviews({ query: 'node_name=Beta', headerUserId: 'user_b' });
  assert.deepEqual(caseC.map((row) => row.id).sort(), [4]);

  const caseD = await fetchReviews({ query: 'node=1&label=LabelOne', headerUserId: 'user_b' });
  assert.deepEqual(caseD.map((row) => row.id).sort(), [3]);

  const caseE = await fetchReviews({ query: 'scope=my', headerUserId: 'user_a' });
  assert.equal(caseE.length, 4);

  const caseF = await fetchReviews({ query: 'scope=all', headerUserId: 'user_b' });
  assert.deepEqual(caseF.map((row) => row.id).sort(), [3, 4]);

  const caseG = await fetchReviews({
    query: 'scope=my',
    headerUserId: 'user_a',
    sessionUserId: 2
  });
  assert.ok(caseG.every((row) => row.user_id === 'user_b'));
  assert.deepEqual(caseG.map((row) => row.id).sort(), [3, 4]);
});
