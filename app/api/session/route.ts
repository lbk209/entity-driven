import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      user_id: user.user_id,
      role: user.role
    }
  });
}
