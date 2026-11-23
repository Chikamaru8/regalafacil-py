const COOKIE_NAME = 'rf_admin_session';

// Sin clave de respaldo: si SESSION_SECRET no existe o es corta, nada se firma ni se valida.
function getSecret(env) {
  const s = env.SESSION_SECRET;
  return typeof s === 'string' && s.length >= 32 ? s : null;
}

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signPayload(payloadB64, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(env, ttlSeconds = 60 * 60 * 24 * 7) {
  const secret = getSecret(env);
  if (!secret) throw new Error('SESSION_SECRET no está configurado (mínimo 32 caracteres)');
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify({ role: 'admin', exp })));
  const sigB64 = await signPayload(payloadB64, secret);
  return `${payloadB64}.${sigB64}`;
}

export function getCookieValue(request, name = COOKIE_NAME) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export async function verifySessionToken(token, env) {
  const secret = getSecret(env);
  if (!secret) return false;
  if (!token || !token.includes('.')) return false;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return false;

  const expectedSig = await signPayload(payloadB64, secret);
  if (sigB64.length !== expectedSig.length) return false;

  let diff = 0;
  for (let i = 0; i < sigB64.length; i++) {
    diff |= sigB64.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (diff !== 0) return false;

  try {
    const json = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    return json.role === 'admin' && typeof json.exp === 'number' && json.exp > now;
  } catch {
    return false;
  }
}

export function buildSessionCookie(token, maxAge = 60 * 60 * 24 * 7) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}
