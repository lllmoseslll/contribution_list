import { NextResponse } from 'next/server';
import { calculateBudgetState, getSettings } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const budgetState = await calculateBudgetState();
    const settings = await getSettings();

    return NextResponse.json(
      {
        ...budgetState,
        paymentInfo: settings.paymentInfo || {}
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      }
    );
  } catch (err) {
    console.error('Error in /api/budget GET:', err);
    return NextResponse.json({ error: 'Failed to retrieve budget state' }, { status: 500 });
  }
}
