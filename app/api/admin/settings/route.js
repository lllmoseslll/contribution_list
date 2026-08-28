import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/budget-service';
import { isAdminRequest, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const settings = getSettings();

  if (!isAdminRequest(req)) {
    // Public branch: only what the public page actually renders.
    return NextResponse.json({
      ownerName: settings.ownerName,
      ownerPhone: settings.ownerPhone,
      ownerEmail: settings.ownerEmail,
      paymentInfo: settings.paymentInfo,
      smtpConfigured: Boolean(settings.smtp?.enabled && settings.smtp?.user)
    });
  }

  return NextResponse.json(settings);
}

export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();

  // The passcode is no longer a setting: it comes from ADMIN_PIN in the
  // environment. Drop it from any incoming body so a stale client cannot
  // write a credential back into data/settings.json.
  const { adminPin, ...safe } = body;

  return NextResponse.json({ success: true, settings: updateSettings(safe) });
}
