/**
 * Kwanjula Contribution & Pledges Board - Frontend Client
 * Real-time WebSocket synchronization, dynamic subtraction, and email triggers
 */

// Application State
let appState = {
  budget: null,
  activeCategory: 'all',
  activeFilter: 'all',
  searchQuery: '',
  selectedItemForPledge: null,
  adminPin: '',
  adminAuthenticated: false,
  ws: null,
  reconnectInterval: null
};

// Currency Formatter
function formatUGX(num) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(num || 0);
}

// Relative / Nice Date Formatter
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// DOM Elements
const elements = {
  // Stats
  statTotalBudget: document.getElementById('statTotalBudget'),
  statTotalPledged: document.getElementById('statTotalPledged'),
  statTotalRemaining: document.getElementById('statTotalRemaining'),
  statPercentFunded: document.getElementById('statPercentFunded'),
  statPledgersCount: document.getElementById('statPledgersCount'),
  statPledgesTotalCount: document.getElementById('statPledgesTotalCount'),
  overallProgressBar: document.getElementById('overallProgressBar'),
  progressBarLabel: document.getElementById('progressBarLabel'),
  wsStatusText: document.getElementById('wsStatusText'),

  // Containers
  budgetSectionsContainer: document.getElementById('budgetSectionsContainer'),
  pledgesWallGrid: document.getElementById('pledgesWallGrid'),
  toastContainer: document.getElementById('toastContainer'),

  // Search & Filters
  itemSearchInput: document.getElementById('itemSearchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  categoryTabs: document.getElementById('categoryTabs'),

  // Dialogs
  pledgeDialog: document.getElementById('pledgeDialog'),
  successDialog: document.getElementById('successDialog'),
  adminDialog: document.getElementById('adminDialog'),

  // Forms
  pledgeForm: document.getElementById('pledgeForm'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  adminSettingsForm: document.getElementById('adminSettingsForm'),

  // Modal controls
  heroPledgeBtn: document.getElementById('heroPledgeBtn'),
  makeGeneralPledgeBtn: document.getElementById('makeGeneralPledgeBtn'),
  footerPledgeBtn: document.getElementById('footerPledgeBtn'),
  closePledgeDialogBtn: document.getElementById('closePledgeDialogBtn'),
  cancelPledgeBtn: document.getElementById('cancelPledgeBtn'),
  closeSuccessBtn: document.getElementById('closeSuccessBtn'),
  openAdminModalBtn: document.getElementById('openAdminModalBtn'),
  footerAdminBtn: document.getElementById('footerAdminBtn'),
  closeAdminDialogBtn: document.getElementById('closeAdminDialogBtn'),
  viewPaymentInfoBtn: document.getElementById('viewPaymentInfoBtn'),
  refreshPledgesBtn: document.getElementById('refreshPledgesBtn'),
  shareWhatsAppBtn: document.getElementById('shareWhatsAppBtn')
};

// ----------------- WEBSOCKET INITIALIZATION -----------------

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    appState.ws = new WebSocket(wsUrl);

    appState.ws.onopen = () => {
      console.log('Connected to real-time WebSocket server');
      if (elements.wsStatusText) {
        elements.wsStatusText.textContent = 'Live Sync Active';
      }
      clearInterval(appState.reconnectInterval);
    };

    appState.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleSocketMessage(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    appState.ws.onclose = () => {
      console.warn('WebSocket disconnected. Attempting reconnect in 3s...');
      if (elements.wsStatusText) {
        elements.wsStatusText.textContent = 'Reconnecting...';
      }
      appState.reconnectInterval = setTimeout(initWebSocket, 3000);
    };

    appState.ws.onerror = (err) => {
      console.error('WebSocket encountered error:', err);
    };
  } catch (e) {
    console.error('Error creating WebSocket:', e);
    // Fallback to fetch
    fetchBudget();
  }
}

function handleSocketMessage(msg) {
  if (msg.type === 'INITIAL_STATE') {
    appState.budget = msg.payload;
    renderAll();
  } else if (msg.type === 'PLEDGE_ADDED') {
    appState.budget = msg.payload.state;
    renderAll();
    // Show toast for new pledge
    const p = msg.payload.pledge;
    const amtStr = p.amount ? formatUGX(p.amount) : 'a generous amount';
    showToast(`🎉 <strong>${escapeHtml(p.name)}</strong> just pledged <strong>${amtStr}</strong> for <em>${escapeHtml(p.itemName)}</em>!`, 'success');
  } else if (msg.type === 'BUDGET_UPDATED') {
    appState.budget = msg.payload.state;
    renderAll();
    if (appState.adminAuthenticated) {
      loadAdminPledges();
    }
  }
}

// Fallback HTTP Fetch
async function fetchBudget() {
  try {
    const res = await fetch('/api/budget');
    if (!res.ok) throw new Error('Failed to fetch budget');
    const data = await res.json();
    appState.budget = data;
    renderAll();
  } catch (err) {
    console.error('Error loading budget:', err);
    showToast('Could not load budget data. Please refresh.', 'error');
  }
}

// ----------------- RENDERING -----------------

function renderAll() {
  if (!appState.budget) return;
  renderStats();
  renderSections();
  renderPledgesWall();
  populateItemSelectDropdown();
}

function renderStats() {
  const stats = appState.budget.stats || {};
  const totalBudget = stats.totalBudget || 31090000;
  const totalPledged = stats.totalCoveredAndPledged || 0;
  const totalRemaining = stats.totalRemaining !== undefined ? stats.totalRemaining : Math.max(0, totalBudget - totalPledged);
  const percentFunded = stats.totalPercentage || (totalBudget > 0 ? Math.round((totalPledged / totalBudget) * 100) : 0);

  // Update top stats cards
  if (elements.statTotalBudget) elements.statTotalBudget.textContent = formatUGX(totalBudget);
  if (elements.statTotalPledged) elements.statTotalPledged.textContent = formatUGX(totalPledged);
  if (elements.statTotalRemaining) elements.statTotalRemaining.textContent = formatUGX(totalRemaining);
  if (elements.statPercentFunded) elements.statPercentFunded.textContent = `${percentFunded}%`;
  if (elements.statPledgersCount) elements.statPledgersCount.textContent = stats.pledgersCount || 0;
  if (elements.statPledgesTotalCount) elements.statPledgesTotalCount.textContent = `${stats.totalPledgesCount || 0} total pledges`;

  // Update Progress Bar
  if (elements.overallProgressBar) {
    elements.overallProgressBar.style.width = `${Math.min(100, Math.max(2, percentFunded))}%`;
  }
  if (elements.progressBarLabel) {
    elements.progressBarLabel.textContent = `${percentFunded}% of ${formatUGX(totalBudget)} Raised (${formatUGX(totalRemaining)} Remaining)`;
  }
}

function renderSections() {
  const container = elements.budgetSectionsContainer;
  if (!container || !appState.budget.sections) return;

  const sections = appState.budget.sections;
  const activeCategory = appState.activeCategory;
  const activeFilter = appState.activeFilter;
  const query = (appState.searchQuery || '').trim().toLowerCase();

  let html = '';
  let matchingItemsTotal = 0;

  sections.forEach(sec => {
    // Check if section matches category filter
    if (activeCategory !== 'all' && sec.id !== activeCategory) {
      return;
    }

    // Filter items within section
    const matchingItems = (sec.items || []).filter(item => {
      // Search filter
      if (query && !item.name.toLowerCase().includes(query) && !(item.remarks && item.remarks.toLowerCase().includes(query))) {
        return false;
      }

      // Status chip filter
      if (activeFilter === 'needs-pledges') {
        return !item.isFullyFunded && (!item.pledgedAmount || item.pledgedAmount === 0);
      }
      if (activeFilter === 'partially-pledged') {
        return !item.isFullyFunded && item.pledgedAmount > 0;
      }
      if (activeFilter === 'fully-covered') {
        return item.isFullyFunded;
      }

      return true;
    });

    if (matchingItems.length === 0) return;
    matchingItemsTotal += matchingItems.length;

    html += `
      <div class="section-group" id="group-${sec.id}">
        <div class="section-group-header">
          <div class="section-title-wrap">
            <span class="section-code-pill">${sec.code}</span>
            <div>
              <h3 class="section-group-title">Section ${sec.code}: ${escapeHtml(sec.title)}</h3>
              <p class="text-sm">${escapeHtml(sec.description || '')}</p>
            </div>
          </div>
          <div class="section-group-totals">
            <span>Target: <strong>${formatUGX(sec.totalCost)}</strong></span>
            <span>Remaining: <strong class="text-amber">${formatUGX(sec.remainingAmount)}</strong></span>
            <span class="tab-badge">${sec.percentage}% Funded</span>
          </div>
        </div>

        <div class="items-grid">
          ${matchingItems.map(item => renderItemCard(item, sec)).join('')}
        </div>
      </div>
    `;
  });

  if (matchingItemsTotal === 0) {
    html = `
      <div class="loading-state">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 12px;"></i>
        <h3>No matching budget items found</h3>
        <p>Try clearing your search or selecting "All Items" in the filters.</p>
        <button class="btn btn-outline btn-sm mt-3" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderItemCard(item, section) {
  const isCovered = item.isFullyFunded;
  const isPartial = !isCovered && item.pledgedAmount > 0;
  
  let badgeClass = 'badge-needs';
  let badgeText = 'Needs Support';
  if (isCovered) {
    badgeClass = 'badge-covered';
    badgeText = item.remarks === 'Covered' ? 'Covered by Family' : '100% Fully Funded';
  } else if (isPartial) {
    badgeClass = 'badge-partial';
    badgeText = `${item.percentage}% Supported`;
  }

  // Pledgers Tag list
  const recentPledges = item.recentPledges || [];
  let pledgersHtml = '';
  if (isCovered && item.remarks === 'Covered' && recentPledges.length === 0) {
    pledgersHtml = `<span class="pledger-tag"><i class="fa-solid fa-star gold-text"></i> Pre-covered</span>`;
  } else if (recentPledges.length > 0) {
    pledgersHtml = recentPledges.map(p => {
      const amtDisplay = p.amount ? `(${formatUGX(p.amount)})` : '';
      return `
        <span class="pledger-tag" title="${escapeHtml(p.message || 'Pledged for this item')}">
          <i class="fa-solid fa-check text-emerald"></i>
          <strong>${escapeHtml(p.name)}</strong> ${amtDisplay}
        </span>
      `;
    }).join('');
  } else {
    pledgersHtml = `<span class="no-pledgers-hint">Be the first to pledge for this item!</span>`;
  }

  return `
    <div class="item-card ${isCovered ? 'covered-item' : ''}" data-item-id="${item.id}">
      <div class="item-card-top">
        <h4 class="item-name">${escapeHtml(item.name)}</h4>
        <span class="item-badge ${badgeClass}">${badgeText}</span>
      </div>

      <div class="item-meta-row">
        <span><strong>Quantity:</strong> ${escapeHtml(item.qty || '1')}</span>
        ${item.unitCost ? `<span><strong>Unit Cost:</strong> ${formatUGX(item.unitCost)}</span>` : ''}
      </div>

      <div class="item-figures">
        <div class="fig-box">
          <span class="fig-label">Total Cost</span>
          <span class="fig-val">${formatUGX(item.totalCost)}</span>
        </div>
        <div class="fig-box">
          <span class="fig-label">Remaining Needed</span>
          <span class="fig-val ${isCovered ? 'text-emerald' : 'text-amber'}">${formatUGX(item.remainingAmount)}</span>
        </div>
      </div>

      <div class="item-progress-wrap">
        <div class="item-progress-meta">
          <span>Funded</span>
          <span>${item.percentage}%</span>
        </div>
        <div class="mini-progress-bg">
          <div class="mini-progress-fill ${isCovered ? 'full' : ''}" style="width: ${Math.max(item.percentage, isCovered ? 100 : 0)}%;"></div>
        </div>
      </div>

      <div class="item-pledgers-box">
        <div class="item-pledgers-header">
          <i class="fa-solid fa-users"></i> Pledgers / Supporters (${recentPledges.length}):
        </div>
        <div class="pledgers-tags-list">
          ${pledgersHtml}
        </div>
      </div>

      ${isCovered ? `
        <button class="pledge-item-btn disabled-btn" disabled>
          <i class="fa-solid fa-check-double"></i> Item Fully Sponsored
        </button>
      ` : `
        <button class="pledge-item-btn" onclick="openPledgeModalForItem('${item.id}')">
          <i class="fa-solid fa-hand-holding-heart"></i> Pledge for this Item
        </button>
      `}
    </div>
  `;
}

function renderPledgesWall() {
  const container = elements.pledgesWallGrid;
  if (!container || !appState.budget) return;

  // Gather all pledges across all items
  let allPledges = [];
  (appState.budget.sections || []).forEach(sec => {
    (sec.items || []).forEach(itm => {
      (itm.recentPledges || []).forEach(p => {
        allPledges.push({
          ...p,
          itemName: itm.name
        });
      });
    });
  });

  if (allPledges.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #64748b;">
        <i class="fa-regular fa-comments" style="font-size: 2rem; margin-bottom: 8px;"></i>
        <p>No pledges submitted yet. Be the first to pledge and leave your warm wishes for Edwin & Jamirah!</p>
      </div>
    `;
    return;
  }

  // Sort by date descending
  allPledges.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = allPledges.slice(0, 12).map(p => {
    const initials = (p.name || 'W').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const amountStr = p.amount ? formatUGX(p.amount) : 'Anonymous amount';
    return `
      <div class="wall-card">
        <div class="wall-card-header">
          <div class="wall-avatar">${initials}</div>
          <div class="wall-user-info">
            <span class="wall-name">${escapeHtml(p.name)}</span>
            <span class="wall-date">${formatDate(p.date)}</span>
          </div>
        </div>

        <div class="wall-pledge-info">
          <span class="wall-item"><i class="fa-solid fa-gift"></i> ${escapeHtml(p.itemName)}</span>
          <span class="wall-amount">${amountStr}</span>
        </div>

        ${p.message ? `
          <div class="wall-message">"${escapeHtml(p.message)}"</div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function populateItemSelectDropdown() {
  const select = document.getElementById('pledgeItemSelect');
  if (!select || !appState.budget.sections) return;

  let html = `<option value="general">✨ General Ceremony Contribution (Any Amount)</option>`;

  appState.budget.sections.forEach(sec => {
    html += `<optgroup label="Section ${sec.code}: ${escapeHtml(sec.title)}">`;
    (sec.items || []).forEach(itm => {
      const remainingStr = itm.isFullyFunded ? '(Fully Covered)' : `(${formatUGX(itm.remainingAmount)} needed)`;
      html += `<option value="${itm.id}" data-remaining="${itm.remainingAmount}" data-total="${itm.totalCost}" data-section="${sec.title}">${escapeHtml(itm.name)} ${remainingStr}</option>`;
    });
    html += `</optgroup>`;
  });

  select.innerHTML = html;
}

// ----------------- PLEDGE MODAL LOGIC -----------------

window.openPledgeModalForItem = function(itemId) {
  if (!appState.budget) return;

  let foundItem = null;
  let foundSection = null;

  if (itemId && itemId !== 'general') {
    for (const sec of appState.budget.sections) {
      const itm = sec.items.find(i => i.id === itemId);
      if (itm) {
        foundItem = itm;
        foundSection = sec;
        break;
      }
    }
  }

  appState.selectedItemForPledge = foundItem;

  const modalBox = document.getElementById('modalSelectedItemBox');
  const selectGroup = document.getElementById('itemSelectGroup');
  const selectElem = document.getElementById('pledgeItemSelect');

  if (foundItem) {
    // Show item banner
    modalBox.style.display = 'flex';
    selectGroup.style.display = 'none';

    document.getElementById('modalItemSectionTag').textContent = `Section ${foundSection.code}: ${foundSection.title}`;
    document.getElementById('modalItemName').textContent = foundItem.name + (foundItem.qty ? ` (${foundItem.qty})` : '');
    document.getElementById('modalItemTotal').textContent = formatUGX(foundItem.totalCost);
    document.getElementById('modalItemRemaining').textContent = formatUGX(foundItem.remainingAmount);

    if (selectElem) selectElem.value = foundItem.id;

    // Prefill quick cover remaining chip
    const coverChip = document.getElementById('coverRemainingChip');
    if (coverChip) {
      coverChip.style.display = 'inline-block';
      coverChip.dataset.val = foundItem.remainingAmount;
      coverChip.textContent = `Cover Remaining (${formatUGX(foundItem.remainingAmount)})`;
    }
  } else {
    // General contribution
    modalBox.style.display = 'none';
    selectGroup.style.display = 'block';
    if (selectElem) selectElem.value = 'general';

    const coverChip = document.getElementById('coverRemainingChip');
    if (coverChip) coverChip.style.display = 'none';
  }

  // Clear form errors & amount
  document.getElementById('pledgeAmount').value = '';
  elements.pledgeDialog.showModal();
};

function openGeneralPledgeModal() {
  openPledgeModalForItem('general');
}

// Handle Form Submission
if (elements.pledgeForm) {
  elements.pledgeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitPledgeBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Recording Pledge...`;

    try {
      const name = document.getElementById('pledgerName').value.trim();
      const phone = document.getElementById('pledgerPhone').value.trim();
      const email = document.getElementById('pledgerEmail').value.trim();
      const amount = Number(document.getElementById('pledgeAmount').value);
      const paymentMethod = document.getElementById('paymentMethodSelect').value;
      const message = document.getElementById('pledgerMessage').value.trim();
      const isAnonymous = document.getElementById('pledgeAnonymous').checked;
      const hideAmount = document.getElementById('pledgeHideAmount').checked;

      // Determine selected item ID
      let itemId = 'general';
      if (document.getElementById('modalSelectedItemBox').style.display !== 'none' && appState.selectedItemForPledge) {
        itemId = appState.selectedItemForPledge.id;
      } else {
        itemId = document.getElementById('pledgeItemSelect').value;
      }

      if (!name) {
        showToast('Please enter your name.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
      }

      if (!amount || amount <= 0) {
        showToast('Please enter a valid pledge amount.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
      }

      const payload = {
        name,
        phone,
        email,
        amount,
        itemId,
        paymentMethod,
        message,
        isAnonymous,
        hideAmount
      };

      const res = await fetch('/api/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record pledge.');
      }

      // Success!
      elements.pledgeDialog.close();
      elements.pledgeForm.reset();

      // Confetti burst!
      triggerConfetti();

      // Show receipt modal
      document.getElementById('receiptName').textContent = name;
      document.getElementById('receiptItem').textContent = data.pledge.itemName;
      document.getElementById('receiptAmount').textContent = formatUGX(amount);

      // WhatsApp Share setup
      if (elements.shareWhatsAppBtn) {
        const text = encodeURIComponent(`I just pledged ${formatUGX(amount)} towards ${data.pledge.itemName} for Mr. Edwin Laston & Jamirah Nakayemba's Introduction Ceremony on 27th Nov 2026! Join us in contributing here: ${window.location.href}`);
        elements.shareWhatsAppBtn.onclick = () => {
          window.open(`https://wa.me/?text=${text}`, '_blank');
        };
      }

      elements.successDialog.showModal();

    } catch (err) {
      console.error('Submission error:', err);
      showToast(err.message || 'Error recording pledge. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

// ----------------- ADMIN PORTAL LOGIC -----------------

function openAdminModal() {
  if (appState.adminAuthenticated) {
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminDashboardSection').style.display = 'block';
    loadAdminPledges();
    loadAdminNotifications();
  } else {
    document.getElementById('adminLoginSection').style.display = 'block';
    document.getElementById('adminDashboardSection').style.display = 'none';
  }
  elements.adminDialog.showModal();
}

if (elements.adminLoginForm) {
  elements.adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('adminPinInput').value.trim();

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid PIN');

      appState.adminPin = pin;
      appState.adminAuthenticated = true;

      document.getElementById('adminLoginSection').style.display = 'none';
      document.getElementById('adminDashboardSection').style.display = 'block';
      document.getElementById('exportCsvBtn').href = `/api/admin/export.csv?pin=${encodeURIComponent(pin)}`;

      loadAdminPledges();
      loadAdminNotifications();
      showToast('Admin Portal Unlocked', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadAdminPledges() {
  if (!appState.adminAuthenticated) return;
  try {
    const res = await fetch('/api/pledges', {
      headers: { 'x-admin-pin': appState.adminPin }
    });
    const pledges = await res.json();

    const tbody = document.getElementById('adminPledgesTableBody');
    document.getElementById('adminPledgesCount').textContent = pledges.length;

    const totalVal = pledges.reduce((sum, p) => p.status !== 'cancelled' ? sum + Number(p.amount || 0) : sum, 0);
    document.getElementById('adminPledgesValue').textContent = formatUGX(totalVal);

    if (pledges.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 20px; color: #64748b;">No pledges recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = pledges.map(p => {
      const isPaid = p.status === 'received_paid';
      const isCancelled = p.status === 'cancelled';
      let statusClass = 'status-pledged';
      let statusText = 'Pledged (Pending)';
      if (isPaid) { statusClass = 'status-paid'; statusText = 'Paid / Received'; }
      if (isCancelled) { statusClass = 'status-cancelled'; statusText = 'Cancelled'; }

      return `
        <tr>
          <td>${formatDate(p.date)}</td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>
            <div><i class="fa-solid fa-phone"></i> ${escapeHtml(p.phone || '-')}</div>
            ${p.email ? `<div><i class="fa-regular fa-envelope"></i> ${escapeHtml(p.email)}</div>` : ''}
          </td>
          <td>${escapeHtml(p.itemName || 'General')}</td>
          <td><strong>${formatUGX(p.amount)}</strong></td>
          <td>${escapeHtml(p.paymentMethod || 'Mobile Money')}</td>
          <td><span class="status-badge-table ${statusClass}">${statusText}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              ${!isPaid ? `
                <button class="action-icon-btn text-emerald" onclick="updatePledgeStatus('${p.id}', 'received_paid')" title="Mark as Paid / Received">
                  <i class="fa-solid fa-check-circle"></i>
                </button>
              ` : `
                <button class="action-icon-btn" onclick="updatePledgeStatus('${p.id}', 'pledged')" title="Mark as Pending">
                  <i class="fa-solid fa-clock-rotate-left"></i>
                </button>
              `}
              <button class="action-icon-btn btn-delete" onclick="deletePledge('${p.id}')" title="Delete pledge">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading admin pledges:', err);
  }
}

window.updatePledgeStatus = async function(id, status) {
  try {
    const res = await fetch(`/api/admin/pledges/${id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': appState.adminPin
      },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update pledge status');
    loadAdminPledges();
    showToast(`Pledge updated to: ${status}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deletePledge = async function(id) {
  if (!confirm('Are you sure you want to delete this pledge? This will restore the remaining budget amount in real-time.')) {
    return;
  }
  try {
    const res = await fetch(`/api/admin/pledges/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': appState.adminPin }
    });
    if (!res.ok) throw new Error('Failed to delete pledge');
    loadAdminPledges();
    showToast('Pledge deleted successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function loadAdminNotifications() {
  if (!appState.adminAuthenticated) return;
  try {
    const res = await fetch('/api/admin/notifications', {
      headers: { 'x-admin-pin': appState.adminPin }
    });
    const notifs = await res.json();
    const container = document.getElementById('notificationsLogList');

    if (notifs.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b;">No email alerts generated yet. When a user submits a pledge, the notification will show here.</div>`;
      return;
    }

    container.innerHTML = notifs.map(n => {
      return `
        <div class="notif-card">
          <div class="notif-card-header">
            <span><strong>To:</strong> ${escapeHtml(n.recipient)} (${escapeHtml(n.recipientName)})</span>
            <span><i class="fa-regular fa-clock"></i> ${formatDate(n.date)}</span>
          </div>
          <div>
            <strong>Subject:</strong> 🎉 New Pledge: ${escapeHtml(n.pledgerName)} (${formatUGX(n.amount)}) for ${escapeHtml(n.item)}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="badge-sent"><i class="fa-solid fa-circle-check"></i> Status: ${n.status}</span>
            <button class="notif-preview-btn" onclick="previewEmailModal('${n.id}')">
              <i class="fa-solid fa-eye"></i> Preview Formatted Email
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

window.previewEmailModal = async function(notifId) {
  try {
    const res = await fetch('/api/admin/notifications', {
      headers: { 'x-admin-pin': appState.adminPin }
    });
    const notifs = await res.json();
    const item = notifs.find(n => n.id === notifId);
    if (!item) return;

    const win = window.open('', '_blank', 'width=650,height=700');
    win.document.write(item.htmlPreview);
    win.document.close();
  } catch (e) {
    console.error(e);
  }
};

// Admin Settings Form
if (elements.adminSettingsForm) {
  elements.adminSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const ownerName = document.getElementById('settingsOwnerName').value.trim();
      const ownerEmail = document.getElementById('settingsOwnerEmail').value.trim();
      const emailNotificationsEnabled = document.getElementById('settingsEmailEnabled').checked;
      const adminPin = document.getElementById('settingsAdminPin').value.trim();

      const smtpEnabled = document.getElementById('smtpEnabledCheckbox').checked;
      const smtp = {
        enabled: smtpEnabled,
        service: document.getElementById('smtpService').value,
        host: document.getElementById('smtpHost').value.trim(),
        port: Number(document.getElementById('smtpPort').value),
        user: document.getElementById('smtpUser').value.trim(),
        pass: document.getElementById('smtpPass').value.trim(),
        from: document.getElementById('smtpFrom').value.trim()
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': appState.adminPin
        },
        body: JSON.stringify({
          ownerName,
          ownerEmail,
          emailNotificationsEnabled,
          adminPin,
          smtp
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      if (adminPin) appState.adminPin = adminPin;
      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Test Email Button
  const testSmtpBtn = document.getElementById('testSmtpBtn');
  if (testSmtpBtn) {
    testSmtpBtn.addEventListener('click', async () => {
      const statusSpan = document.getElementById('testEmailStatus');
      statusSpan.textContent = 'Sending test email...';
      try {
        const res = await fetch('/api/admin/test-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-pin': appState.adminPin
          },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Test email failed');
        statusSpan.textContent = '✅ ' + data.message;
        statusSpan.style.color = '#15803d';
      } catch (err) {
        statusSpan.textContent = '❌ ' + err.message;
        statusSpan.style.color = '#b91c1c';
      }
    });
  }
}

// ----------------- UI INTERACTIONS & EVENT HANDLERS -----------------

// Category Tabs Click
if (elements.categoryTabs) {
  elements.categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-tab');
    if (!btn) return;

    document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    appState.activeCategory = btn.dataset.category;
    renderSections();
  });
}

// Filter Chips Click
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;

  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');

  appState.activeFilter = chip.dataset.filter;
  renderSections();
});

// Item Search Input
if (elements.itemSearchInput) {
  elements.itemSearchInput.addEventListener('input', (e) => {
    appState.searchQuery = e.target.value;
    if (elements.clearSearchBtn) {
      elements.clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
    }
    renderSections();
  });
}

if (elements.clearSearchBtn) {
  elements.clearSearchBtn.addEventListener('click', () => {
    elements.itemSearchInput.value = '';
    appState.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    renderSections();
  });
}

window.resetFilters = function() {
  appState.activeCategory = 'all';
  appState.activeFilter = 'all';
  appState.searchQuery = '';

  if (elements.itemSearchInput) elements.itemSearchInput.value = '';
  if (elements.clearSearchBtn) elements.clearSearchBtn.style.display = 'none';

  document.querySelectorAll('.category-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.category === 'all');
  });

  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === 'all');
  });

  renderSections();
};

// Quick Amount Chips in Modal
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.amount-chip');
  if (!chip) return;

  const val = Number(chip.dataset.val);
  const amountInput = document.getElementById('pledgeAmount');
  if (amountInput && val) {
    amountInput.value = val;
  }
});

// Change item button in pledge modal
const changeItemBtn = document.getElementById('changeItemBtn');
if (changeItemBtn) {
  changeItemBtn.addEventListener('click', () => {
    document.getElementById('modalSelectedItemBox').style.display = 'none';
    document.getElementById('itemSelectGroup').style.display = 'block';
  });
}

// When item dropdown changes in pledge modal
const pledgeItemSelect = document.getElementById('pledgeItemSelect');
if (pledgeItemSelect) {
  pledgeItemSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.selectedOptions[0];
    const remaining = Number(selectedOption.dataset.remaining || 0);
    const coverChip = document.getElementById('coverRemainingChip');
    if (coverChip) {
      if (remaining > 0) {
        coverChip.style.display = 'inline-block';
        coverChip.dataset.val = remaining;
        coverChip.textContent = `Cover Remaining (${formatUGX(remaining)})`;
      } else {
        coverChip.style.display = 'none';
      }
    }
  });
}

// Copy Mobile Money Numbers
document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.copy-btn');
  if (!copyBtn) return;

  const textToCopy = copyBtn.dataset.copy;
  if (textToCopy) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      const origHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = `<i class="fa-solid fa-check text-emerald"></i>`;
      showToast(`Copied ${textToCopy} to clipboard`, 'success');
      setTimeout(() => { copyBtn.innerHTML = origHtml; }, 2000);
    });
  }
});

// Admin Navigation Tabs
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.admin-tab-btn');
  if (!tabBtn) return;

  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  tabBtn.classList.add('active');

  const tabId = tabBtn.dataset.tab;
  document.querySelectorAll('.admin-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabId}`);
  });
});

// Smtp Checkbox Toggle
const smtpCheckbox = document.getElementById('smtpEnabledCheckbox');
if (smtpCheckbox) {
  smtpCheckbox.addEventListener('change', (e) => {
    document.getElementById('smtpFieldsContainer').style.display = e.target.checked ? 'block' : 'none';
  });
}

// Open / Close Modal buttons
if (elements.heroPledgeBtn) elements.heroPledgeBtn.addEventListener('click', () => openPledgeModalForItem(null));
if (elements.makeGeneralPledgeBtn) elements.makeGeneralPledgeBtn.addEventListener('click', openGeneralPledgeModal);
if (elements.footerPledgeBtn) elements.footerPledgeBtn.addEventListener('click', openGeneralPledgeModal);
if (elements.closePledgeDialogBtn) elements.closePledgeDialogBtn.addEventListener('click', () => elements.pledgeDialog.close());
if (elements.cancelPledgeBtn) elements.cancelPledgeBtn.addEventListener('click', () => elements.pledgeDialog.close());
if (elements.closeSuccessBtn) elements.closeSuccessBtn.addEventListener('click', () => elements.successDialog.close());

if (elements.openAdminModalBtn) elements.openAdminModalBtn.addEventListener('click', openAdminModal);
if (elements.footerAdminBtn) elements.footerAdminBtn.addEventListener('click', openAdminModal);
if (elements.closeAdminDialogBtn) elements.closeAdminDialogBtn.addEventListener('click', () => elements.adminDialog.close());

if (elements.viewPaymentInfoBtn) {
  elements.viewPaymentInfoBtn.addEventListener('click', () => {
    document.getElementById('paymentDetailsSection').scrollIntoView({ behavior: 'smooth' });
  });
}

if (elements.refreshPledgesBtn) {
  elements.refreshPledgesBtn.addEventListener('click', () => {
    fetchBudget();
    showToast('Refreshed contribution list', 'success');
  });
}

// Record Manual Pledge button in Admin
const openManualPledgeBtn = document.getElementById('openManualPledgeBtn');
if (openManualPledgeBtn) {
  openManualPledgeBtn.addEventListener('click', () => {
    elements.adminDialog.close();
    openGeneralPledgeModal();
  });
}

// ----------------- UTILITIES -----------------

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="flex: 1;">${message}</div>
    <button style="background:none; border:none; color:#cbd5e1; cursor:pointer;" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 5000);
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d97706', '#059669', '#fbbf24', '#10b981', '#ffffff']
    });
  }
}

// ----------------- STARTUP -----------------
document.addEventListener('DOMContentLoaded', () => {
  fetchBudget();
  initWebSocket();
});
