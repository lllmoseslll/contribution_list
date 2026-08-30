import { NextResponse } from 'next/server';
import { deleteGuest } from '@/lib/guest-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const existed = await deleteGuest(id);

  if (!existed) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Guest removed' });
}
