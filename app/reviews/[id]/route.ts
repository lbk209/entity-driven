import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const reviewId = Number(params.id);
  const url = new URL(request.url);
  const nextParams = new URLSearchParams(url.searchParams.toString());
  if (Number.isFinite(reviewId) && reviewId > 0) {
    nextParams.set('review', String(reviewId));
    if (!nextParams.get('entity_id')) {
      const db = getDb();
      const row = db
        .prepare('SELECT entity_id FROM review WHERE id = ?')
        .get(reviewId) as { entity_id: number | null } | undefined;
      if (row?.entity_id !== null && row?.entity_id !== undefined) {
        nextParams.set('entity_id', String(row.entity_id));
      }
    }
  }
  const target = new URL('/entity-reviews', url.origin);
  if (nextParams.toString()) {
    target.search = nextParams.toString();
  }
  return NextResponse.redirect(target, 307);
}
