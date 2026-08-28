import 'server-only';

import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * The single place the committee passcode is read and compared.
 *
 * There is deliberately no fallback value. The previous arrangement compared
 * against `settings.adminPin || 'edwin2026'` in nine separate route handlers,
 * which meant a deployment that configured nothing still authenticated anyone
 * who knew a string that was printed on a public page. An unset ADMIN_PIN now
 * authenticates nobody, and says so.
 *
 * Auth checks live here rather than in a proxy.js: Next 16 deprecated the
 * middleware convention, recommends avoiding it, and warns against relying on
 * shared modules inside it. Route handlers call requireAdmin() directly.
 */

export const MISSING_PIN_MESSAGE =
  'ADMIN_PIN is not set on this server. Set it in .env (see .env.example) and restart.';

export const BAD_PIN_MESSAGE = 'Invalid or missing admin passcode.';

/** The configured passcode, or null when unset or empty. */
export function getAdminPin() {
  const pin = process.env.ADMIN_PIN;
  return typeof pin === 'string' && pin.length > 0 ? pin : null;
}

/** Constant-time string comparison, length-safe. */
export function matchesAdminPin(provided) {
  const expected = getAdminPin();
  if (!expected || typeof provided !== 'string' || provided.length === 0) return false;

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  // Hash both sides first so the compared buffers are always 32 bytes.
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** True when this request carries a valid admin credential. */
export function isAdminRequest(req) {
  return matchesAdminPin(req.headers.get('x-admin-pin'));
}

/**
 * Guard for admin route handlers.
 *
 *   const denied = requireAdmin(req);
 *   if (denied) return denied;
 *
 * Returns a NextResponse to send back, or null when the caller is authorised.
 */
export function requireAdmin(req) {
  if (!getAdminPin()) {
    return NextResponse.json({ error: MISSING_PIN_MESSAGE }, { status: 401 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: BAD_PIN_MESSAGE }, { status: 401 });
  }
  return null;
}
