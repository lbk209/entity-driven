import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const entities = db
    .prepare(
      'SELECT id, name, type FROM nodes ORDER BY name ASC'
    )
    .all();

  return NextResponse.json({ entities });
}
