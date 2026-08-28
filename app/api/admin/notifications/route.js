import { NextResponse } from 'next/server';
import { getNotifications } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  return NextResponse.json(getNotifications());
}
