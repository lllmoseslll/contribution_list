import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** Ends the session. Safe to call when there is none. */
export async function POST() {
  return clearSessionCookie(NextResponse.json({ success: true }));
}
