import fs from 'fs';
import path from 'path';
import { query, ensureSchema } from './db.js';
import { readJSON } from './budget-service.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');

function guestFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    date: row.created_at.toISOString()
  };
}

/** Alphabetical by name — this is a list people scan for their own name, not a feed. */
export async function getGuests() {
  try {
    await ensureSchema();
    const { rows } = await query('SELECT * FROM guests ORDER BY name ASC');
    return rows.map(guestFromRow);
  } catch (err) {
    console.warn('[guest-service] Database unavailable, falling back to local guests.json:', err.message);
    const guests = readJSON(GUESTS_FILE, []);
    return [...guests].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
}

export async function addGuest(guest) {
  try {
    await ensureSchema();
    const { rows } = await query(
      `INSERT INTO guests (id, name, phone) VALUES ($1, $2, $3) RETURNING *`,
      [guest.id, guest.name, guest.phone || '']
    );
    return guestFromRow(rows[0]);
  } catch (err) {
    console.warn('[guest-service] Database unavailable, saving to local guests.json:', err.message);
    const existing = readJSON(GUESTS_FILE, []);
    const newEntry = { ...guest, date: new Date().toISOString() };
    existing.unshift(newEntry);
    try {
      fs.writeFileSync(GUESTS_FILE, JSON.stringify(existing, null, 2), 'utf8');
    } catch {}
    return newEntry;
  }
}

/** Returns true if a guest with that id existed and was deleted. */
export async function deleteGuest(id) {
  try {
    await ensureSchema();
    const { rowCount } = await query('DELETE FROM guests WHERE id = $1', [id]);
    return rowCount > 0;
  } catch (err) {
    console.warn('[guest-service] Database unavailable, deleting from local guests.json:', err.message);
    const existing = readJSON(GUESTS_FILE, []);
    const filtered = existing.filter(g => g.id !== id);
    if (filtered.length !== existing.length) {
      try {
        fs.writeFileSync(GUESTS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
      } catch {}
      return true;
    }
    return false;
  }
}
