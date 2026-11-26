const COOKIE_NAME = 'rf_admin_session';

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

export async function createSessionToken(env, sessionData = { role: 'admin' }, ttlSeconds = 60 * 60 * 24 * 7) {
  const secret = getSecret(env);
  if (!secret) throw new Error('SESSION_SECRET no está configurado (mínimo 32 caracteres)');
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = {
    role: sessionData.role === 'seller' ? 'seller' : 'admin',
    sellerId: sessionData.role === 'seller' ? Number(sessionData.sellerId) : null,
    email: sessionData.email || null,
    name: sessionData.name || (sessionData.role === 'seller' ? 'Vendedor' : 'Administrador'),
    exp
  };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
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

export async function getSession(request, env) {
  const token = getCookieValue(request);
  const secret = getSecret(env);
  if (!secret || !token || !token.includes('.')) return null;

  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = await signPayload(payloadB64, secret);
  if (sigB64.length !== expectedSig.length) return null;

  let diff = 0;
  for (let i = 0; i < sigB64.length; i++) {
    diff |= sigB64.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const json = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    if (typeof json.exp !== 'number' || json.exp <= now) return null;
    if (json.role === 'admin') {
      return { role: 'admin', sellerId: null, email: json.email || null, name: json.name || 'Administrador' };
    }
    if (json.role === 'seller' && json.sellerId) {
      return {
        role: 'seller',
        sellerId: Number(json.sellerId),
        email: json.email || null,
        name: json.name || 'Vendedor'
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifySessionToken(token, env) {
  const secret = getSecret(env);
  if (!secret || !token || !token.includes('.')) return false;
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
    return (json.role === 'admin' || (json.role === 'seller' && Boolean(json.sellerId))) &&
      typeof json.exp === 'number' &&
      json.exp > now;
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

export async function hashPassword(password, saltHex = null) {
  const enc = new TextEncoder();
  let saltBytes;
  if (saltHex) {
    saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
  } else {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
  }
  const actualSaltHex = Array.from(saltBytes, b => b.toString(16).padStart(2, '0')).join('');
  const combined = new Uint8Array(saltBytes.length + enc.encode(password).length);
  combined.set(saltBytes, 0);
  combined.set(enc.encode(password), saltBytes.length);

  const digest = await crypto.subtle.digest('SHA-256', combined);
  const hashHex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `${actualSaltHex}:${hashHex}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [saltHex, expectedHash] = storedHash.split(':');
  const computed = await hashPassword(password, saltHex);
  const [, actualHash] = computed.split(':');
  return timingSafeEqualStr(actualHash, expectedHash);
}