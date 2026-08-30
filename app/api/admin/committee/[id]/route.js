import { NextResponse } from 'next/server';
import { deleteCommitteeMember } from '@/lib/committee-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const existed = await deleteCommitteeMember(id);

  if (!existed) {
    return NextResponse.json({ error: 'Committee member not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Committee member removed' });
}
