import { NextResponse } from 'next/server';
import { deletePledge, calculateBudgetState } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const existed = await deletePledge(id);

  if (!existed) {
    return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });
  }

  const updatedState = await calculateBudgetState();

  return NextResponse.json({ success: true, message: 'Pledge deleted', stats: updatedState.stats });
}
