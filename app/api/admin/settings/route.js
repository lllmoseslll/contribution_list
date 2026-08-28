import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Strip the SMTP password out of anything that leaves the server, replacing it
 * with a boolean. The browser has no use for the password and every reason not
 * to hold it: the old settings form read it into React state, kept it there for
 * the session, and POSTed it back on every save.
 */
function withoutSecrets(settings) {
  const { smtp = {}, ...rest } = settings;
  const { pass, ...smtpSafe } = smtp;
  return { ...rest, smtp: { ...smtpSafe, hasPassword: Boolean(pass) } };
}

/**
 * Admin only. This route used to answer unauthenticated callers with a
 * "sanitised" payload carrying ownerEmail and ownerPhone — which meant the
 * address that receives pledge alerts was available to anyone who asked. It had
 * no consumer: the public page reads paymentInfo from /api/budget, and the only
 * other caller was the legacy static console deleted in Step 1.
 */
export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  return NextResponse.json(withoutSecrets(getSettings()));
}

export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();

  // The passcode is not a setting: it comes from ADMIN_PIN in the environment.
  // Drop it so no client can write a credential into data/settings.json.
  const { adminPin, ...safe } = body;

  // hasPassword is a read-only projection; never let it round-trip into storage.
  if (safe.smtp && typeof safe.smtp === 'object') {
    const { hasPassword, ...smtp } = safe.smtp;
    // An absent or empty password means "leave the stored one alone", so the
    // client never has to hold it in order to save anything else.
    if (!smtp.pass) delete smtp.pass;
    safe.smtp = smtp;
  }

  return NextResponse.json({ success: true, settings: withoutSecrets(updateSettings(safe)) });
}
