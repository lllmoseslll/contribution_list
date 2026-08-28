import { NextResponse } from 'next/server';
import { getAdminPin, matchesAdminPin, MISSING_PIN_MESSAGE, BAD_PIN_MESSAGE } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { pin } = await req.json().catch(() => ({}));

  if (!getAdminPin()) {
    return NextResponse.json({ success: false, error: MISSING_PIN_MESSAGE }, { status: 401 });
  }

  if (!matchesAdminPin(pin)) {
    return NextResponse.json({ success: false, error: BAD_PIN_MESSAGE }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
