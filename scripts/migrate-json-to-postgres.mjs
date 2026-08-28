// One-time migration: reads the existing data/*.json files this app used to
// write to a serverless-incompatible filesystem, and inserts their contents
// into Postgres. Safe to re-run — pledges and notifications are inserted
// with ON CONFLICT (id) DO NOTHING, and settings is a single upsert.
//
// Usage:
//   POSTGRES_URL=postgresql://... node scripts/migrate-json-to-postgres.mjs
//
// Run this once against a freshly-provisioned database, before the first
// deploy that removes data/pledges.json, data/settings.json and
// data/notifications.json from disk. data/budget.json is untouched — it
// was never migrated, since the app never wrote to it (see
// lib/budget-service.js's own comment on why it stays a bundled file).
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('POSTGRES_URL is not set. Pass it inline or export it before running this script.');
  process.exit(1);
}

const isLocal = (() => {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
})();

const pool = new Pool({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false } });

const DATA_DIR = path.join(process.cwd(), 'data');

function readJSON(file, fallback) {
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) {
    console.log(`  ${file} not found, skipping (fallback: ${JSON.stringify(fallback)})`);
    return fallback;
  }
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT settings_is_singleton CHECK (id = 1)
    );

    CREATE TABLE IF NOT EXISTS pledges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      amount NUMERIC NOT NULL,
      item_id TEXT NOT NULL DEFAULT 'general',
      item_name TEXT NOT NULL DEFAULT 'General Contribution',
      section_id TEXT,
      section_code TEXT NOT NULL DEFAULT 'General',
      section_title TEXT NOT NULL DEFAULT 'General',
      message TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'Mobile Money',
      is_anonymous BOOLEAN NOT NULL DEFAULT false,
      hide_amount BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pledged',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS pledges_created_at_idx ON pledges (created_at DESC);
    CREATE INDEX IF NOT EXISTS pledges_item_id_idx ON pledges (item_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'pledge_alert',
      recipient TEXT,
      recipient_name TEXT,
      pledger_name TEXT,
      pledger_phone TEXT,
      amount NUMERIC,
      item TEXT,
      status TEXT NOT NULL DEFAULT 'recorded',
      error TEXT,
      html_preview TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

    INSERT INTO settings (id, data) VALUES (1, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function migrateSettings() {
  const settings = readJSON('settings.json', null);
  if (!settings) return;
  // adminPin never belonged in settings even in the JSON-file era (the admin
  // route already strips it on every save) — dropped here too in case an
  // old file still carries it from before that change.
  const { adminPin, ...safe } = settings;
  await pool.query(
    `INSERT INTO settings (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify(safe)]
  );
  console.log('  settings migrated.');
}

async function migratePledges() {
  const pledges = readJSON('pledges.json', []);
  let inserted = 0;
  for (const p of pledges) {
    const { rowCount } = await pool.query(
      `INSERT INTO pledges
         (id, name, phone, email, amount, item_id, item_name, section_id, section_code, section_title,
          message, payment_method, is_anonymous, hide_amount, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id, p.name, p.phone || '', p.email || '', p.amount,
        p.itemId || 'general', p.itemName || 'General Contribution',
        p.sectionId || null, p.sectionCode || 'General', p.sectionTitle || 'General',
        p.message || '', p.paymentMethod || 'Mobile Money',
        Boolean(p.isAnonymous), Boolean(p.hideAmount), p.status || 'pledged',
        p.date || new Date().toISOString()
      ]
    );
    inserted += rowCount;
  }
  console.log(`  pledges: ${inserted} inserted, ${pledges.length - inserted} already present.`);
}

async function migrateNotifications() {
  const notifs = readJSON('notifications.json', []);
  let inserted = 0;
  for (const n of notifs) {
    const { rowCount } = await pool.query(
      `INSERT INTO notifications
         (id, type, recipient, recipient_name, pledger_name, pledger_phone, amount, item, status, error, html_preview, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        n.id, n.type || 'pledge_alert', n.recipient || null, n.recipientName || null,
        n.pledgerName || null, n.pledgerPhone || null, n.amount ?? null, n.item || null,
        n.status || 'recorded', n.error || null, n.htmlPreview || null,
        n.date || new Date().toISOString()
      ]
    );
    inserted += rowCount;
  }
  console.log(`  notifications: ${inserted} inserted, ${notifs.length - inserted} already present.`);
}

console.log(`Migrating data/*.json into Postgres (${isLocal ? 'local' : 'remote, TLS'} connection)...`);
await ensureSchema();
await migrateSettings();
await migratePledges();
await migrateNotifications();
await pool.end();
console.log('Done.');
