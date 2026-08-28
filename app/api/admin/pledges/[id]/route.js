import { NextResponse } from 'next/server';
import { getPledges, savePledges, calculateBudgetState, budgetEvents } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  let pledges = getPledges();
  const initialLength = pledges.length;
  pledges = pledges.filter(p => p.id !== id);

  if (pledges.length === initialLength) {
    return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });
  }

  savePledges(pledges);

  const updatedState = calculateBudgetState();
  budgetEvents.emit('update', { type: 'BUDGET_UPDATED', state: updatedState });

  return NextResponse.json({ success: true, message: 'Pledge deleted', stats: updatedState.stats });
}
