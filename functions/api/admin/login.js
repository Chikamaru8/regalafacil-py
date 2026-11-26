import {
  buildSessionCookie,
  createSessionToken,
  timingSafeEqualStr,
  verifyPassword
} from './_auth.js';

const MAX_FAILS = 5;
const WINDOW_SECONDS = 15 * 60;

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

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!password) {
    return Response.json({ error: 'Ingresá tu contraseña' }, { status: 400 });
  }

  async function recordFail() {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM login_fail WHERE ts < ?').bind(now - WINDOW_SECONDS),
      env.DB.prepare('INSERT INTO login_fail (ip, ts) VALUES (?, ?)').bind(ip, now)
    ]);
  }

  // 1) Intento como Administrador General
  const adminEmailEnv = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const isAdminAttempt = !email || (adminEmailEnv && email === adminEmailEnv);

  if (isAdminAttempt && timingSafeEqualStr(password, env.ADMIN_PASSWORD)) {
    let token;
    try {
      token = await createSessionToken(env, {
        role: 'admin',
        email: adminEmailEnv || null,
        name: 'Administrador'
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }

    await env.DB.prepare('DELETE FROM login_fail WHERE ip = ?').bind(ip).run();
    return new Response(
      JSON.stringify({ ok: true, role: 'admin', name: 'Administrador' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': buildSessionCookie(token) }
      }
    );
  }

  // 2) Intento como Vendedor registrado por correo
  if (email) {
    const seller = await env.DB.prepare(
      'SELECT id, slug, name, email, password_hash, approval_status, active FROM seller WHERE lower(email) = ? LIMIT 1'
    ).bind(email).first();

    if (!seller || !seller.password_hash) {
      await recordFail();
      return Response.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 });
    }

    const passOk = await verifyPassword(password, seller.password_hash);
    if (!passOk) {
      await recordFail();
      return Response.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 });
    }

    if (seller.approval_status === 'pending') {
      return Response.json(
        { error: 'Tu cuenta está pendiente de aprobación por el administrador. Te avisaremos cuando sea habilitada.' },
        { status: 403 }
      );
    }

    if (seller.approval_status === 'rejected' || Number(seller.active) !== 1) {
      return Response.json(
        { error: 'Tu cuenta no está activa actualmente. Consultá con el administrador.' },
        { status: 403 }
      );
    }

    let token;
    try {
      token = await createSessionToken(env, {
        role: 'seller',
        sellerId: Number(seller.id),
        email: seller.email,
        name: seller.name
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }

    await env.DB.prepare('DELETE FROM login_fail WHERE ip = ?').bind(ip).run();
    return new Response(
      JSON.stringify({
        ok: true,
        role: 'seller',
        sellerId: Number(seller.id),
        name: seller.name,
        slug: seller.slug
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': buildSessionCookie(token) }
      }
    );
  }

  await recordFail();
  return Response.json({ error: 'Credenciales incorrectas' }, { status: 401 });
}