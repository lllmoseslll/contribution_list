import { NextResponse } from 'next/server';
import { calculateBudgetState, addPledge } from '@/lib/budget-service';
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
    if (isNaN(numAmount) || numAmount < 5000) {
      return NextResponse.json({
        error: 'Please enter a valid contribution of 5,000 UGX or more.'
      }, { status: 400 });
    }

    // Get current budget state to check remaining balance on items
    const currentState = await calculateBudgetState();

    let selectedItem = null;
    let selectedSection = null;
    let currentItemRemaining = 0;

    if (itemId && itemId !== 'general') {
      for (const sec of currentState.sections || []) {
        const itm = sec.items.find(i => i.id === itemId);
        if (itm) {
          selectedItem = itm;
          selectedSection = sec;
          currentItemRemaining = itm.remainingAmount;
          break;
        }
      }
    }

    let primaryPledge = null;
    let spilloverPledge = null;
    let spilloverInfo = null;
    let responseMessage = 'Pledge recorded successfully! Thank you for your generous contribution.';

    const basePledge = {
      name: name.trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      message: (message || '').trim(),
      paymentMethod: paymentMethod || 'Mobile Money',
      isAnonymous: Boolean(isAnonymous),
      hideAmount: Boolean(hideAmount),
      status: 'pledged'
    };

    // Case 1: Pledging for a specific budget item
    if (selectedItem) {
      if (currentItemRemaining <= 0) {
        // Item is ALREADY 100% covered — allocate entire pledge to General Contribution
        spilloverPledge = await addPledge({
          ...basePledge,
          id: 'pledge-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
          amount: numAmount,
          itemId: 'general',
          itemName: 'General Ceremony Contribution',
          sectionId: null,
          sectionCode: 'General',
          sectionTitle: 'General Ceremony Fund',
          message: (basePledge.message ? basePledge.message + ' • ' : '') + `(Allocated to General Fund as ${selectedItem.name} is already fully sponsored)`
        });

        spilloverInfo = {
          covered100: true,
          itemName: selectedItem.name,
          itemAmount: 0,
          spilloverAmount: numAmount
        };

        responseMessage = `🎉 ${selectedItem.name} was already fully sponsored! Your full contribution of UGX ${numAmount.toLocaleString()} has been added to the General Ceremony Fund. Thank you!`;
      } else if (numAmount > currentItemRemaining) {
        // Pledged MORE than the item needed — cover item 100% and spill over the rest to General Fund
        const itemCoverAmount = currentItemRemaining;
        const generalExcess = numAmount - currentItemRemaining;

        primaryPledge = await addPledge({
          ...basePledge,
          id: 'pledge-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
          amount: itemCoverAmount,
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          sectionId: selectedSection ? selectedSection.id : null,
          sectionCode: selectedSection ? selectedSection.code : 'General',
          sectionTitle: selectedSection ? selectedSection.title : 'General'
        });

        spilloverPledge = await addPledge({
          ...basePledge,
          id: 'pledge-' + (Date.now() + 1) + '-' + Math.floor(Math.random() * 10000),
          amount: generalExcess,
          itemId: 'general',
          itemName: 'General Ceremony Contribution',
          sectionId: null,
          sectionCode: 'General',
          sectionTitle: 'General Ceremony Fund',
          message: (basePledge.message ? basePledge.message + ' • ' : '') + `(Excess spillover from covering ${selectedItem.name} 100%)`
        });

        spilloverInfo = {
          covered100: true,
          itemName: selectedItem.name,
          itemAmount: itemCoverAmount,
          spilloverAmount: generalExcess
        };

        responseMessage = `🎉 Outstanding! You have covered ${selectedItem.name} 100% (UGX ${itemCoverAmount.toLocaleString()})! Your extra UGX ${generalExcess.toLocaleString()} has been added to the General Ceremony Fund.`;
      } else {
        // Pledged exact amount or partial amount for item
        primaryPledge = await addPledge({
          ...basePledge,
          id: 'pledge-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
          amount: numAmount,
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          sectionId: selectedSection ? selectedSection.id : null,
          sectionCode: selectedSection ? selectedSection.code : 'General',
          sectionTitle: selectedSection ? selectedSection.title : 'General'
        });

        const isNow100 = numAmount === currentItemRemaining;
        if (isNow100) {
          spilloverInfo = {
            covered100: true,
            itemName: selectedItem.name,
            itemAmount: numAmount,
            spilloverAmount: 0
          };
          responseMessage = `🎉 Congratulations! You have covered ${selectedItem.name} 100%! Thank you for your wonderful blessing.`;
        }
      }
    } else {
      // Case 2: General Ceremony Contribution
      primaryPledge = await addPledge({
        ...basePledge,
        id: 'pledge-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        amount: numAmount,
        itemId: 'general',
        itemName: 'General Contribution',
        sectionId: null,
        sectionCode: 'General',
        sectionTitle: 'General Ceremony Fund'
      });
      responseMessage = `Thank you for your generous contribution of UGX ${numAmount.toLocaleString()} towards Edwin & Jamirah's Ceremony!`;
    }

    // Compute updated state immediately
    const updatedState = await calculateBudgetState();

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

    // Trigger email notification asynchronously with spillover details
    const activePledgeForEmail = primaryPledge || spilloverPledge;
    sendPledgeNotifications(activePledgeForEmail, itemInfo, updatedState.stats, spilloverInfo).catch(err => {
      console.error('Error sending notification:', err);
    });

    return NextResponse.json({
      success: true,
      message: responseMessage,
      pledge: activePledgeForEmail,
      spilloverInfo,
      stats: updatedState.stats
    }, { status: 201 });

  } catch (err) {
    console.error('Pledge API error:', err);
    return NextResponse.json({ error: 'Failed to process pledge' }, { status: 500 });
  }
}
