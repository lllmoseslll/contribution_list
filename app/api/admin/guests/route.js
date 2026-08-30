import { NextResponse } from 'next/server';
import { getGuests, addGuest } from '@/lib/guest-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const guests = await getGuests();
  return NextResponse.json(guests);
}

export async function POST(req) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const body = await req.json();
    const { name, phone } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Guest name is required.' }, { status: 400 });
    }

    const newGuest = await addGuest({
      id: 'guest-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      name: name.trim(),
      phone: (phone || '').trim()
    });

    return NextResponse.json({ success: true, guest: newGuest }, { status: 201 });
  } catch (err) {
    console.error('Admin guest creation error:', err);
    return NextResponse.json({ error: 'Failed to add guest' }, { status: 500 });
  }
}
