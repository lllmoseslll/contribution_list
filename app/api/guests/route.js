import { NextResponse } from 'next/server';
import { getGuests } from '@/lib/guest-service';

export const dynamic = 'force-dynamic';

/** Public, read-only. Guests are only ever added or removed from the admin portal. */
export async function GET() {
  const guests = await getGuests();
  return NextResponse.json(guests);
}
