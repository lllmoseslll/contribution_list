import { NextResponse } from 'next/server';
import {
  configurationError,
  matchesAdminPin,
  setSessionCookie,
  clearSessionCookie,
  isAdminRequest,
  BAD_PIN_MESSAGE
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** Whether the browser already holds a valid session — used on mount. */
export async function GET(req) {
  return NextResponse.json({ authenticated: isAdminRequest(req) });
}

/** Exchange the passcode for a session cookie. The passcode is sent once. */
export async function POST(req) {
  const misconfigured = configurationError();
  if (misconfigured) {
    return NextResponse.json({ success: false, error: misconfigured }, { status: 401 });
  }

  const { pin } = await req.json().catch(() => ({}));

  if (!matchesAdminPin(pin)) {
    // Clear any stale cookie so a failed attempt cannot leave one behind.
    return clearSessionCookie(
      NextResponse.json({ success: false, error: BAD_PIN_MESSAGE }, { status: 401 })
    );
  }

  return setSessionCookie(NextResponse.json({ success: true }));
}
