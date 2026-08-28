import 'server-only';

import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * The single place the committee credential is read, compared and carried.
 *
 * The passcode is submitted exactly once, to POST /api/admin/verify, and is
 * exchanged for a signed session cookie. Every other admin route reads the
 * cookie. The passcode itself is never replayed on subsequent requests and
 * never appears in a URL: a credential in a query string lands in browser
 * history, server access logs and any proxy in between, and a credential
 * replayed as a header is one interception away from the same outcome.
 *
 * There are deliberately no fallback values. The previous arrangement compared
 * against `settings.adminPin || 'edwin2026'` in nine separate route handlers,
 * so a deployment that configured nothing still authenticated anyone who knew
 * a string that was printed on a public page. An unset ADMIN_PIN or
 * ADMIN_SESSION_SECRET now authenticates nobody, and says which one is missing.
 *
 * Auth checks live here rather than in a proxy.js: Next 16 deprecated the
 * middleware convention, recommends avoiding it, and warns against relying on
 * shared modules inside it. Route handlers call requireAdmin() directly.
 */

export const SESSION_COOKIE = 'kwanjula_admin';

/** Eight hours — long enough for a committee sitting, short enough to expire. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const MISSING_PIN_MESSAGE =
  'ADMIN_PIN is not set on this server. Set it in .env (see .env.example) and restart.';

export const MISSING_SECRET_MESSAGE =
  'ADMIN_SESSION_SECRET is not set on this server. Set it in .env (see .env.example) and restart.';

export const BAD_PIN_MESSAGE = 'Invalid admin passcode.';

export const NO_SESSION_MESSAGE = 'Not signed in, or the session has expired.';

/* ------------------------------------------------------------------ config */

/** The configured passcode, or null when unset or empty. */
export function getAdminPin() {
  const pin = process.env.ADMIN_PIN;
  return typeof pin === 'string' && pin.length > 0 ? pin : null;
}

/** The configured session signing secret, or null when unset or empty. */
export function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return typeof secret === 'string' && secret.length > 0 ? secret : null;
}

/**
 * The reason this server cannot authenticate anyone, or null when configured.
 * Checked before any credential is looked at, so a misconfigured deployment
 * fails loudly by name instead of silently rejecting a correct passcode.
 */
export function configurationError() {
  if (!getAdminPin()) return MISSING_PIN_MESSAGE;
  if (!getSessionSecret()) return MISSING_SECRET_MESSAGE;
  return null;
}

/* -------------------------------------------------------------- passcode */

/** Constant-time passcode comparison, length-safe. */
export function matchesAdminPin(provided) {
  const expected = getAdminPin();
  if (!expected || typeof provided !== 'string' || provided.length === 0) return false;

  // timingSafeEqual throws on a length mismatch, which would itself leak
  // length. Hash both sides first so the compared buffers are always 32 bytes.
  const a = crypto.createHash('sha256').update(Buffer.from(provided, 'utf8')).digest();
  const b = crypto.createHash('sha256').update(Buffer.from(expected, 'utf8')).digest();
  return crypto.timingSafeEqual(a, b);
}

/* --------------------------------------------------------------- session */

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest();
}

/**
 * A signed, self-contained session token: base64url(JSON).base64url(HMAC).
 *
 * There is no session store — one shared committee credential does not need
 * one, and a file-backed store would inherit data/'s non-atomic writes. The
 * expiry is inside the signed payload, so it cannot be extended by editing the
 * cookie, and rotating ADMIN_SESSION_SECRET invalidates every issued session.
 */
export function createSessionToken(nowMs = Date.now()) {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payload = b64url(JSON.stringify({
    v: 1,
    iat: nowMs,
    exp: nowMs + SESSION_MAX_AGE_SECONDS * 1000
  }));

  return `${payload}.${b64url(sign(payload, secret))}`;
}

/** True when the token is well-formed, correctly signed and unexpired. */
export function verifySessionToken(token, nowMs = Date.now()) {
  const secret = getSessionSecret();
  if (!secret || typeof token !== 'string') return false;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return false;

  const payloadB64 = token.slice(0, dot);
  let provided;
  try {
    provided = Buffer.from(token.slice(dot + 1), 'base64url');
  } catch {
    return false;
  }

  const expected = sign(payloadB64, secret);
  if (provided.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(provided, expected)) return false;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return false;
  }

  return payload?.v === 1 && typeof payload.exp === 'number' && payload.exp > nowMs;
}

/** Cookie attributes shared by the set and clear paths. */
export function sessionCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

/** Attach a fresh session to a response. */
export function setSessionCookie(res) {
  const token = createSessionToken();
  if (!token) return res;
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
  return res;
}

/** Clear the session on a response. */
export function clearSessionCookie(res) {
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return res;
}

/* ----------------------------------------------------------------- guards */

function readSessionCookie(req) {
  const fromNext = req.cookies?.get?.(SESSION_COOKIE)?.value;
  if (fromNext) return fromNext;

  // Fallback for a plain Request without NextRequest's cookie parsing.
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/** True when this request carries a valid admin session. */
export function isAdminRequest(req) {
  if (configurationError()) return false;
  return verifySessionToken(readSessionCookie(req));
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
  const misconfigured = configurationError();
  if (misconfigured) {
    return NextResponse.json({ error: misconfigured }, { status: 401 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: NO_SESSION_MESSAGE }, { status: 401 });
  }
  return null;
}
