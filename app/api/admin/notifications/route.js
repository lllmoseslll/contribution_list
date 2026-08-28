import { NextResponse } from 'next/server';
import { getSettings, getNotifications } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const pin = req.headers.get('x-admin-pin');
  const settings = getSettings();

  if (pin !== (settings.adminPin || 'edwin2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notifs = getNotifications();
  return NextResponse.json(notifs);
}
