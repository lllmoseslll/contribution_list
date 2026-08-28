import { NextResponse } from 'next/server';
import { calculateBudgetState, getSettings } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const budgetState = calculateBudgetState();
  const settings = getSettings();

  return NextResponse.json({
    ...budgetState,
    paymentInfo: settings.paymentInfo || {}
  });
}
