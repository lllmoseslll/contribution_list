import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const pin = req.headers.get('x-admin-pin');
  const settings = getSettings();
  const isAdmin = pin === (settings.adminPin || 'edwin2026');

  if (!isAdmin) {
    // Return sanitized public info
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
  const pin = req.headers.get('x-admin-pin');
  const currentSettings = getSettings();

  if (pin !== (currentSettings.adminPin || 'edwin2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const updated = updateSettings(body);

  return NextResponse.json({ success: true, settings: updated });
}
