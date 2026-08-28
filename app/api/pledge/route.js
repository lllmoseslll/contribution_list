import { NextResponse } from 'next/server';
import { calculateBudgetState, getPledges, savePledges, budgetEvents } from '@/lib/budget-service';
import { sendPledgeNotifications } from '@/lib/mailer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, phone, email, amount, itemId, message, paymentMethod, isAnonymous, hideAmount } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Contributor name is required.' }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Please enter a valid pledge amount greater than 0.' }, { status: 400 });
    }

    // Read current budget
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

    const newPledge = {
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
      paymentMethod: paymentMethod || 'Mobile Money',
      isAnonymous: Boolean(isAnonymous),
      hideAmount: Boolean(hideAmount),
      status: 'pledged',
      date: new Date().toISOString()
    };

    const pledges = getPledges();
    pledges.unshift(newPledge);
    savePledges(pledges);

    // Compute updated state immediately
    const updatedState = calculateBudgetState();

    let itemInfo = null;
    if (selectedItem) {
      for (const sec of updatedState.sections) {
        const itm = sec.items.find(i => i.id === selectedItem.id);
        if (itm) {
          itemInfo = {
            name: itm.name,
            sectionTitle: sec.title,
            remainingAmount: itm.remainingAmount,
            pledgedAmount: itm.pledgedAmount,
            percentage: itm.percentage
          };
          break;
        }
      }
    }

    // Trigger email notification asynchronously
    sendPledgeNotifications(newPledge, itemInfo, updatedState.stats).catch(err => {
      console.error('Error sending notification:', err);
    });

    // Emit event for real-time SSE stream to update all connected clients
    budgetEvents.emit('update', {
      type: 'PLEDGE_ADDED',
      pledge: {
        id: newPledge.id,
        name: newPledge.isAnonymous ? 'Generous Well-wisher' : newPledge.name,
        amount: newPledge.hideAmount ? null : newPledge.amount,
        itemName: newPledge.itemName,
        itemId: newPledge.itemId,
        message: newPledge.message,
        date: newPledge.date
      },
      state: updatedState
    });

    return NextResponse.json({
      success: true,
      message: 'Pledge recorded successfully! Thank you for your contribution.',
      pledge: newPledge,
      stats: updatedState.stats
    }, { status: 201 });

  } catch (err) {
    console.error('Pledge API error:', err);
    return NextResponse.json({ error: 'Failed to process pledge' }, { status: 500 });
  }
}
