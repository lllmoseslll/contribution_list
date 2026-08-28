import { NextResponse } from 'next/server';
import { getPledges, addPledge, calculateBudgetState } from '@/lib/budget-service';
import { requireAdmin } from '@/lib/admin-auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const pledges = await getPledges();
  return NextResponse.json(pledges);
}

export async function POST(req) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const body = await req.json();
    const { name, phone, email, amount, itemId, message, paymentMethod, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Contributor name is required.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 5000) {
      return NextResponse.json({ error: 'Please enter a valid amount of 5,000 UGX or more.' }, { status: 400 });
    }

    // Read current budget to resolve item name
    const budgetFile = path.join(process.cwd(), 'data', 'budget.json');
    const budget = JSON.parse(fs.readFileSync(budgetFile, 'utf8'));

    let selectedItem = null;
    let selectedSection = null;

    if (itemId && itemId !== 'general') {
      for (const sec of budget.sections || []) {
        const itm = sec.items.find(i => i.id === itemId);
        if (itm) {
          selectedItem = itm;
          selectedSection = sec;
          break;
        }
      }
    }

    const newPledge = await addPledge({
      id: 'pledge-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      name: name.trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      amount: numAmount,
      itemId: itemId || 'general',
      itemName: selectedItem ? selectedItem.name : 'General Contribution',
      sectionId: selectedSection ? selectedSection.id : null,
      sectionCode: selectedSection ? selectedSection.code : 'General',
      sectionTitle: selectedSection ? selectedSection.title : 'General',
      message: (message || '').trim(),
      paymentMethod: paymentMethod || 'Cash / Hand Delivery',
      isAnonymous: false,
      hideAmount: false,
      status: status || 'paid' // default to paid if entered by committee as offline receipt
    });

    const updatedState = await calculateBudgetState();

    return NextResponse.json({
      success: true,
      message: 'Offline pledge recorded successfully.',
      pledge: newPledge,
      stats: updatedState.stats
    }, { status: 201 });

  } catch (err) {
    console.error('Admin pledge creation error:', err);
    return NextResponse.json({ error: 'Failed to record offline pledge' }, { status: 500 });
  }
}
