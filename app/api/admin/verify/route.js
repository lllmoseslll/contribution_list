import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { pin } = await req.json();
  const settings = getSettings();
  const expectedPin = settings.adminPin || process.env.ADMIN_PIN || 'edwin2026';

  if (pin === expectedPin) {
    return NextResponse.json({ success: true, token: 'admin-ok' });
  } else {
    return NextResponse.json({ success: false, error: 'Invalid admin passcode' }, { status: 401 });
  }
}
