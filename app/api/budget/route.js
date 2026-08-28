import { NextResponse } from 'next/server';
import { calculateBudgetState, getSettings } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const budgetState = await calculateBudgetState();
    const settings = await getSettings();

    return NextResponse.json({
      ...budgetState,
      paymentInfo: settings.paymentInfo || {}
    });
  } catch (err) {
    console.error('Error in /api/budget GET:', err);
    return NextResponse.json({ error: 'Failed to retrieve budget state' }, { status: 500 });
  }
}
