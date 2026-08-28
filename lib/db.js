import 'server-only';

import { Pool } from 'pg';

/**
 * One Postgres pool per server process, reused across requests — and, on
 * Vercel, across warm invocations of the same function instance. Created
 * lazily so importing this module never touches the network by itself.
 *
 * POSTGRES_URL is the variable Vercel Postgres (and its underlying Neon
 * database) injects automatically once a project is linked to one in the
 * dashboard; `vercel env pull` writes the same name into .env.local for
 * local development. Any other Postgres-compatible provider (Supabase, a
 * local Docker instance) works too — it's a standard connection string.
 */
let pool;

function isLocalConnection(connectionString) {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      'POSTGRES_URL is not set. Provision a Postgres database (Vercel Postgres, Neon, or Supabase — ' +
      'or a local instance for development) and set POSTGRES_URL in .env. See .env.example.'
    );
  }

  pool = new Pool({
    connectionString,
    // Hosted providers (Vercel Postgres/Neon, Supabase) require TLS and use
    // certificates a local Node install won't have in its trust store; a
    // local database has no TLS listener at all. `sslmode=require` in the
    // connection string itself would be enough for hosted providers, but
    // this makes the same POSTGRES_URL work against a bare local Postgres
    // too, without asking the user to vary it by environment.
    ssl: isLocalConnection(connectionString) ? false : { rejectUnauthorized: false },
    max: 5
  });

  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

let schemaReady;

/**
 * Creates every table this app needs if they don't already exist. Called
 * once, lazily, before the first query in a given process — safe to call
 * repeatedly (CREATE TABLE IF NOT EXISTS), so a cold start on Vercel just
 * pays this cost once per new function instance rather than needing a
 * separate deploy step the user has to remember to run.
 */
export async function ensureSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = query(`
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
  `).then(() => true);

  return schemaReady;
}
