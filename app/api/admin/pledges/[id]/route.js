import { NextResponse } from 'next/server';
import { getSettings, getPledges, savePledges, calculateBudgetState, budgetEvents } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  const pin = req.headers.get('x-admin-pin');
  const settings = getSettings();

  if (pin !== (settings.adminPin || 'edwin2026')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
