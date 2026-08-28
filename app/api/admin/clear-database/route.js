import { NextResponse } from 'next/server';
import { clearAllData } from '@/lib/budget-service';
import { requireAdmin, matchesAdminPin, BAD_PIN_MESSAGE } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Wipes every pledge and notification. A valid admin session alone is not
 * enough to reach this: the request must also re-submit the admin passcode
 * in its body, checked again here with the same constant-time comparison
 * /api/admin/verify uses. That second factor exists specifically for this
 * route — an unlocked committee laptop left unattended, or a stray click,
 * should not be able to erase every recorded pledge on its own.
 */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  if (!matchesAdminPin(body?.password)) {
    return NextResponse.json({ error: BAD_PIN_MESSAGE }, { status: 401 });
  }

  const result = await clearAllData();

  return NextResponse.json({
    success: true,
    message: `Cleared ${result.pledgesCleared} pledge${result.pledgesCleared === 1 ? '' : 's'} and ${result.notificationsCleared} notification${result.notificationsCleared === 1 ? '' : 's'}.`,
    ...result
  });
}
