import { NextResponse } from 'next/server';
import { getPledges, savePledges, calculateBudgetState, budgetEvents } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const { status } = await req.json();

  const pledges = getPledges();
  const pledge = pledges.find(p => p.id === id);

  if (!pledge) {
    return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });
  }

  pledge.status = status || pledge.status;
  savePledges(pledges);

  const updatedState = calculateBudgetState();
  budgetEvents.emit('update', { type: 'BUDGET_UPDATED', state: updatedState });

  return NextResponse.json({ success: true, pledge, stats: updatedState.stats });
}
