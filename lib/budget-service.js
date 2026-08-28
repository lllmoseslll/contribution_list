import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const DATA_DIR = path.join(process.cwd(), 'data');
const BUDGET_FILE = path.join(DATA_DIR, 'budget.json');
const PLEDGES_FILE = path.join(DATA_DIR, 'pledges.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Global event emitter for real-time SSE updates
export const budgetEvents = new EventEmitter();
budgetEvents.setMaxListeners(100);

export function readJSON(file, defaultVal = {}) {
  try {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2), 'utf8');
      return defaultVal;
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultVal;
  }
}

export function writeJSON(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

export function formatUGX(num) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(num || 0);
}

export function calculateBudgetState() {
  const budget = readJSON(BUDGET_FILE, {});
  const pledges = readJSON(PLEDGES_FILE, []);

  // Filter valid pledges (ignore cancelled)
  const activePledges = pledges.filter(p => p.status !== 'cancelled');

  let totalBudget = 0;
  let totalCoveredAndPledged = 0;
  const uniquePledgers = new Set();

  const sections = (budget.sections || []).map(sec => {
    let secTotalCost = 0;
    let secPledged = 0;

    const items = sec.items.map(item => {
      secTotalCost += item.totalCost || 0;

      // Find pledges for this item
      const itemPledges = activePledges.filter(p => p.itemId === item.id);
      const userPledgedForItem = itemPledges.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      itemPledges.forEach(p => {
        if (p.name) uniquePledgers.add(p.name.trim().toLowerCase());
      });

      let pledgedAmount = 0;
      let remainingAmount = 0;

      if (item.covered) {
        // Pre-covered in the budget
        pledgedAmount = item.totalCost;
        remainingAmount = 0;
      } else {
        pledgedAmount = userPledgedForItem;
        remainingAmount = Math.max(0, item.totalCost - pledgedAmount);
      }

      secPledged += pledgedAmount;

      const percentage = item.totalCost > 0
        ? Math.min(100, Math.round((pledgedAmount / item.totalCost) * 100))
        : 100;

      return {
        ...item,
        pledgedAmount,
        remainingAmount,
        percentage,
        isFullyFunded: item.covered || remainingAmount === 0,
        pledgesCount: itemPledges.length,
        recentPledges: itemPledges.map(p => ({
          id: p.id,
          name: p.isAnonymous ? 'Generous Well-wisher' : p.name,
          amount: p.hideAmount ? null : p.amount,
          message: p.message || '',
          date: p.date,
          status: p.status || 'pledged'
        }))
      };
    });

    const secPercentage = secTotalCost > 0
      ? Math.min(100, Math.round((secPledged / secTotalCost) * 100))
      : 100;

    totalBudget += secTotalCost;
    totalCoveredAndPledged += secPledged;

    return {
      ...sec,
      totalCost: secTotalCost,
      pledgedAmount: secPledged,
      remainingAmount: Math.max(0, secTotalCost - secPledged),
      percentage: secPercentage,
      items
    };
  });

  // Handle general pledges
  const generalPledges = activePledges.filter(p => !p.itemId || p.itemId === 'general');
  const generalPledgedAmount = generalPledges.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  generalPledges.forEach(p => {
    if (p.name) uniquePledgers.add(p.name.trim().toLowerCase());
  });

  totalCoveredAndPledged += generalPledgedAmount;

  const totalRemaining = Math.max(0, totalBudget - totalCoveredAndPledged);
  const totalPercentage = totalBudget > 0
    ? Math.min(100, Math.round((totalCoveredAndPledged / totalBudget) * 100))
    : 100;

  return {
    ...budget,
    sections,
    recentGeneralPledges: generalPledges.map(p => ({
      id: p.id,
      name: p.isAnonymous ? 'Generous Well-wisher' : p.name,
      amount: p.hideAmount ? null : p.amount,
      itemName: 'General Ceremony Contribution',
      message: p.message || '',
      date: p.date,
      status: p.status || 'pledged'
    })),
    stats: {
      totalBudget,
      totalCoveredAndPledged,
      totalRemaining,
      generalPledgedAmount,
      totalPercentage,
      pledgersCount: uniquePledgers.size,
      totalPledgesCount: activePledges.length,
      lastUpdated: new Date().toISOString()
    }
  };
}

export function getSettings() {
  return readJSON(SETTINGS_FILE, {});
}

export function updateSettings(newSettings) {
  const current = getSettings();
  const merged = { ...current, ...newSettings };
  writeJSON(SETTINGS_FILE, merged);
  return merged;
}

export function getPledges() {
  return readJSON(PLEDGES_FILE, []);
}

export function savePledges(pledges) {
  return writeJSON(PLEDGES_FILE, pledges);
}

export function getNotifications() {
  return readJSON(NOTIFICATIONS_FILE, []);
}

export function saveNotifications(notifs) {
  return writeJSON(NOTIFICATIONS_FILE, notifs);
}
