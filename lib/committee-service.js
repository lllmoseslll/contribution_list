import fs from 'fs';
import path from 'path';
import { query, ensureSchema } from './db.js';
import { readJSON } from './budget-service.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const COMMITTEE_FILE = path.join(DATA_DIR, 'committee.json');

// Uganda mobile money network, guessed from the phone's carrier prefix so the
// committee never has to pick MTN vs Airtel by hand when adding someone.
const MTN_PREFIXES = ['077', '078', '076', '039'];
const AIRTEL_PREFIXES = ['070', '074', '075'];

function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('256')) return '0' + digits.slice(3);
  if (digits.startsWith('0')) return digits;
  return digits.length === 9 ? '0' + digits : digits;
}

/** 'MTN Money' | 'Airtel Money' | null (network shown as generic "Mobile Money"). */
export function detectMobileNetwork(phone) {
  const prefix = normalizePhone(phone).slice(0, 3);
  if (MTN_PREFIXES.includes(prefix)) return 'MTN Money';
  if (AIRTEL_PREFIXES.includes(prefix)) return 'Airtel Money';
  return null;
}

function committeeMemberFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    network: row.network || null,
    role: row.role || '',
    date: row.created_at.toISOString()
  };
}

/** Oldest first — a fixed, predictable card order on the public payment section. */
export async function getCommitteeMembers() {
  try {
    await ensureSchema();
    const { rows } = await query('SELECT * FROM committee_members ORDER BY created_at ASC');
    return rows.map(committeeMemberFromRow);
  } catch (err) {
    console.warn('[committee-service] Database unavailable, falling back to local committee.json:', err.message);
    return readJSON(COMMITTEE_FILE, []);
  }
}

export async function addCommitteeMember(member) {
  const phone = normalizePhone(member.phone);
  const network = detectMobileNetwork(phone);
  const role = (member.role || '').trim();
  try {
    await ensureSchema();
    const { rows } = await query(
      `INSERT INTO committee_members (id, name, phone, network, role) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [member.id, member.name, phone, network || '', role]
    );
    return committeeMemberFromRow(rows[0]);
  } catch (err) {
    console.warn('[committee-service] Database unavailable, saving to local committee.json:', err.message);
    const existing = readJSON(COMMITTEE_FILE, []);
    const newEntry = { id: member.id, name: member.name, phone, network, role, date: new Date().toISOString() };
    existing.push(newEntry);
    try {
      fs.writeFileSync(COMMITTEE_FILE, JSON.stringify(existing, null, 2), 'utf8');
    } catch {}
    return newEntry;
  }
}

/** Returns true if a committee member with that id existed and was deleted. */
export async function deleteCommitteeMember(id) {
  try {
    await ensureSchema();
    const { rowCount } = await query('DELETE FROM committee_members WHERE id = $1', [id]);
    return rowCount > 0;
  } catch (err) {
    console.warn('[committee-service] Database unavailable, deleting from local committee.json:', err.message);
    const existing = readJSON(COMMITTEE_FILE, []);
    const filtered = existing.filter(m => m.id !== id);
    if (filtered.length !== existing.length) {
      try {
        fs.writeFileSync(COMMITTEE_FILE, JSON.stringify(filtered, null, 2), 'utf8');
      } catch {}
      return true;
    }
    return false;
  }
}
