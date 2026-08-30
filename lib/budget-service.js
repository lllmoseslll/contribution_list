import fs from 'fs';
import path from 'path';
import { query, ensureSchema } from './db.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const BUDGET_FILE = path.join(DATA_DIR, 'budget.json');

/**
 * budget.json is the only piece of data this app still reads from disk. It
 * is curated by the committee ahead of time and never written to at
 * runtime (grep the whole app for `writeJSON(BUDGET_FILE` — there is no
 * such call), so it can safely ship as a read-only file inside the
 * deployment bundle: Vercel's serverless filesystem is read-only outside
 * `/tmp`, but reads work exactly as they do locally. Pledges, settings and
 * notifications are all written at runtime and live in Postgres instead —
 * see lib/db.js.
 */
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

export function formatUGX(num) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(num || 0);
}

// ---------------------------------------------------------------- Pledges

function pledgeFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    amount: Number(row.amount),
    itemId: row.item_id,
    itemName: row.item_name,
    sectionId: row.section_id,
    sectionCode: row.section_code,
    sectionTitle: row.section_title,
    message: row.message,
    paymentMethod: row.payment_method,
    isAnonymous: row.is_anonymous,
    hideAmount: row.hide_amount,
    status: row.status,
    date: row.created_at.toISOString()
  };
}

export async function getPledges() {
  try {
    await ensureSchema();
    const { rows } = await query('SELECT * FROM pledges ORDER BY created_at DESC');
    return rows.map(pledgeFromRow);
  } catch (err) {
    console.warn('[budget-service] Database unavailable, falling back to local pledges.json:', err.message);
    return readJSON(path.join(DATA_DIR, 'pledges.json'), []);
  }
}

/**
 * Inserts one pledge and returns it in the same shape getPledges() uses.
 * Replaces the old read-the-whole-array / unshift / write-the-whole-array
 * pattern, which was flagged as a real concurrency risk (two simultaneous
 * pledges could interleave and one would be lost) — a single INSERT has no
 * such window; Postgres serialises it.
 */
export async function addPledge(pledge) {
  try {
    await ensureSchema();
    const { rows } = await query(
      `INSERT INTO pledges
         (id, name, phone, email, amount, item_id, item_name, section_id, section_code, section_title,
          message, payment_method, is_anonymous, hide_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        pledge.id, pledge.name, pledge.phone || '', pledge.email || '', pledge.amount,
        pledge.itemId || 'general', pledge.itemName || 'General Contribution',
        pledge.sectionId || null, pledge.sectionCode || 'General', pledge.sectionTitle || 'General',
        pledge.message || '', pledge.paymentMethod || 'Mobile Money',
        Boolean(pledge.isAnonymous), Boolean(pledge.hideAmount), pledge.status || 'pledged'
      ]
    );
    return pledgeFromRow(rows[0]);
  } catch (err) {
    console.warn('[budget-service] Database unavailable, saving to local pledges.json:', err.message);
    const file = path.join(DATA_DIR, 'pledges.json');
    const existing = readJSON(file, []);
    const newEntry = {
      ...pledge,
      date: new Date().toISOString()
    };
    existing.unshift(newEntry);
    try {
      fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf8');
    } catch {}
    return newEntry;
  }
}

/** Returns the updated pledge, or null if no pledge has that id. */
export async function updatePledgeStatus(id, status) {
  try {
    await ensureSchema();
    const { rows } = await query('UPDATE pledges SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return rows[0] ? pledgeFromRow(rows[0]) : null;
  } catch (err) {
    console.warn('[budget-service] Database unavailable, updating local pledges.json:', err.message);
    const file = path.join(DATA_DIR, 'pledges.json');
    const existing = readJSON(file, []);
    const found = existing.find(p => p.id === id);
    if (found) {
      found.status = status;
      try {
        fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf8');
      } catch {}
      return found;
    }
    return null;
  }
}

/** Returns true if a pledge with that id existed and was deleted. */
export async function deletePledge(id) {
  try {
    await ensureSchema();
    const { rowCount } = await query('DELETE FROM pledges WHERE id = $1', [id]);
    return rowCount > 0;
  } catch (err) {
    console.warn('[budget-service] Database unavailable, deleting from local pledges.json:', err.message);
    const file = path.join(DATA_DIR, 'pledges.json');
    const existing = readJSON(file, []);
    const filtered = existing.filter(p => p.id !== id);
    if (filtered.length !== existing.length) {
      try {
        fs.writeFileSync(file, JSON.stringify(filtered, null, 2), 'utf8');
      } catch {}
      return true;
    }
    return false;
  }
}

/**
 * Deletes every pledge and notification — a full reset of contribution data,
 * used only by the admin "Clear Database" danger-zone action. Deliberately
 * leaves the settings row untouched: SMTP config, notification inboxes and
 * committee contact details are configuration, not records, and wiping them
 * would force re-entering them after every reset. Returns how many rows of
 * each were removed, so the caller can show a concrete confirmation.
 */
export async function clearAllData() {
  try {
    await ensureSchema();
    const [pledgesResult, notifsResult] = await Promise.all([
      query('DELETE FROM pledges'),
      query('DELETE FROM notifications')
    ]);
    return { pledgesCleared: pledgesResult.rowCount, notificationsCleared: notifsResult.rowCount };
  } catch (err) {
    console.warn('[budget-service] Database unavailable, clearing local pledges.json/notifications.json:', err.message);
    const pledgesFile = path.join(DATA_DIR, 'pledges.json');
    const notifsFile = path.join(DATA_DIR, 'notifications.json');
    const pledgesCleared = readJSON(pledgesFile, []).length;
    const notificationsCleared = readJSON(notifsFile, []).length;
    try { fs.writeFileSync(pledgesFile, '[]', 'utf8'); } catch {}
    try { fs.writeFileSync(notifsFile, '[]', 'utf8'); } catch {}
    return { pledgesCleared, notificationsCleared };
  }
}

// --------------------------------------------------------------- Settings

export async function getSettings() {
  try {
    await ensureSchema();
    const { rows } = await query('SELECT data FROM settings WHERE id = 1');
    return rows[0]?.data || {};
  } catch (err) {
    console.warn('[budget-service] Database unavailable, reading local settings.json:', err.message);
    return readJSON(path.join(DATA_DIR, 'settings.json'), {});
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Recursive merge, arrays replaced wholesale.
 *
 * A shallow spread here meant a POST carrying a partial `smtp` object replaced
 * the stored one entirely, silently dropping whatever it omitted — the host,
 * the port, or the saved password. Nothing hit it while the only client sent
 * the whole settings object back every time, which is also why the browser was
 * holding the SMTP password in React state for the session.
 */
function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key])
      ? deepMerge(base[key], value)
      : value;
  }
  return out;
}

export async function updateSettings(newSettings) {
  const current = await getSettings();
  const merged = deepMerge(current, newSettings);
  try {
    await ensureSchema();
    await query(
      `INSERT INTO settings (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(merged)]
    );
  } catch (err) {
    console.warn('[budget-service] Database unavailable, saving to local settings.json:', err.message);
    const file = path.join(DATA_DIR, 'settings.json');
    try {
      fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf8');
    } catch {}
  }
  return merged;
}

// ----------------------------------------------------------- Notifications

function notificationFromRow(row) {
  return {
    id: row.id,
    type: row.type,
    recipient: row.recipient,
    recipientName: row.recipient_name,
    pledgerName: row.pledger_name,
    pledgerPhone: row.pledger_phone,
    amount: row.amount === null ? null : Number(row.amount),
    item: row.item,
    generalFundAmount: row.general_fund_amount ? Number(row.general_fund_amount) : 0,
    status: row.status,
    error: row.error,
    htmlPreview: row.html_preview,
    date: row.created_at.toISOString()
  };
}

/** Most recent 100 — the same cap the old flat-file version trimmed to on write. */
export async function getNotifications() {
  try {
    await ensureSchema();
    const { rows } = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
    return rows.map(notificationFromRow);
  } catch (err) {
    console.warn('[budget-service] Database unavailable, reading local notifications.json:', err.message);
    return readJSON(path.join(DATA_DIR, 'notifications.json'), []);
  }
}

export async function addNotification(notif) {
  try {
    await ensureSchema();
    const { rows } = await query(
      `INSERT INTO notifications
         (id, type, recipient, recipient_name, pledger_name, pledger_phone, amount, item, general_fund_amount, status, error, html_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        notif.id, notif.type || 'pledge_alert', notif.recipient || null, notif.recipientName || null,
        notif.pledgerName || null, notif.pledgerPhone || null, notif.amount ?? null, notif.item || null,
        notif.generalFundAmount || 0, notif.status || 'recorded', notif.error || null, notif.htmlPreview || null
      ]
    );
    return notificationFromRow(rows[0]);
  } catch (err) {
    console.warn('[budget-service] Database unavailable, saving to local notifications.json:', err.message);
    const file = path.join(DATA_DIR, 'notifications.json');
    const existing = readJSON(file, []);
    const newEntry = {
      ...notif,
      date: new Date().toISOString()
    };
    existing.unshift(newEntry);
    try {
      fs.writeFileSync(file, JSON.stringify(existing.slice(0, 100), null, 2), 'utf8');
    } catch {}
    return newEntry;
  }
}

// ------------------------------------------------------------ Budget state

export async function calculateBudgetState() {
  const budget = readJSON(BUDGET_FILE, {});
  const pledges = await getPledges();

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
