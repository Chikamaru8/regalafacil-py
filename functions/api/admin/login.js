import {
  buildSessionCookie,
  createSessionToken,
  timingSafeEqualStr
} from './_auth.js';

const MAX_FAILS = 5;          // intentos fallidos permitidos...
const WINDOW_SECONDS = 15 * 60; // ...dentro de esta ventana, por IP

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Falta configurar ADMIN_PASSWORD en Cloudflare Pages' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare('CREATE TABLE IF NOT EXISTS login_fail (ip TEXT NOT NULL, ts INTEGER NOT NULL)').run();
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_fail WHERE ip = ? AND ts > ?')
    .bind(ip, now - WINDOW_SECONDS).first();
  if ((row?.n || 0) >= MAX_FAILS) {
    return Response.json(
      { error: 'Demasiados intentos. Esperá 15 minutos e intentá de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(WINDOW_SECONDS) } }
    );
  }

  const password = String(body?.password || '');
  if (!timingSafeEqualStr(password, env.ADMIN_PASSWORD)) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM login_fail WHERE ts < ?').bind(now - WINDOW_SECONDS),
      env.DB.prepare('INSERT INTO login_fail (ip, ts) VALUES (?, ?)').bind(ip, now)
    ]);
    return Response.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  let token;
  try {
    token = await createSessionToken(env);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  await env.DB.prepare('DELETE FROM login_fail WHERE ip = ?').bind(ip).run();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': buildSessionCookie(token) }
  });
}
