import { NextResponse } from 'next/server';
import { getPledges, updatePledgeStatus, calculateBudgetState } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const { status } = await req.json();

  // An empty/falsy status means "leave it as it is" — the original
  // behaviour this route always had — so only write when one was given.
  let pledge;
  if (status) {
    pledge = await updatePledgeStatus(id, status);
  } else {
    const pledges = await getPledges();
    pledge = pledges.find(p => p.id === id) || null;
  }

  if (!pledge) {
    return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });
  }

  const updatedState = await calculateBudgetState();

  return NextResponse.json({ success: true, pledge, stats: updatedState.stats });
}
