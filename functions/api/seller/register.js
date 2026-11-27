import {
  buildSessionCookie,
  createSessionToken,
  hashPassword
} from '../admin/_auth.js';
import {
  buildAdminNewSellerEmail,
  buildSellerWelcomeEmail,
  sendEmail
} from '../admin/_email.js';

const DEFAULT_TRIAL_DAYS = 60;
const DAY_SEC = 86400;

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'vendedor';
}

function normalizePhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '595' + d.slice(1);
  return d;
}

async function ensureSellerPlanColumns(db) {
  const alters = [
    "ALTER TABLE seller ADD COLUMN plan_type TEXT DEFAULT 'trial'",
    'ALTER TABLE seller ADD COLUMN plan_ends_at INTEGER',
    'ALTER TABLE seller ADD COLUMN created_at INTEGER',
    'ALTER TABLE seller ADD COLUMN last_login_at INTEGER'
  ];
  for (const sql of alters) {
    try { await db.prepare(sql).run(); } catch {}
  }
}

async function logOnboardingEvent(db, payload) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS onboarding_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER,
        name TEXT NOT NULL,
        city TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        slug TEXT DEFAULT '',
        method TEXT DEFAULT 'Correo y contraseña',
        welcome_sent INTEGER DEFAULT 0,
        admin_notified INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `).run();

    await db.prepare(`
      INSERT INTO onboarding_log (
        seller_id, name, city, phone, email, slug, method, welcome_sent, admin_notified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      payload.sellerId ?? null,
      payload.name,
      payload.city || '',
      payload.phone || '',
      payload.email || '',
      payload.slug || '',
      payload.method || 'Correo y contraseña',
      payload.welcomeSent ? 1 : 0,
      payload.adminNotified ? 1 : 0,
      payload.createdAt
    ).run();
  } catch (err) {
    console.error('Error guardando onboarding_log:', err);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = String(body?.name || '').trim().slice(0, 60);
  const city = String(body?.city || '').trim().slice(0, 60);
  const email = String(body?.email || '').trim().toLowerCase().slice(0, 120);
  const password = String(body?.password || '');
  const phone = normalizePhone(body?.phone || '');

  if (name.length < 2) {
    return Response.json({ error: 'Ingresá tu nombre o el nombre de tu tienda' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Ingresá un correo electrónico válido' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }
  if (phone.length < 8) {
    return Response.json({ error: 'Ingresá un número de WhatsApp válido (ej. 0981 123 456)' }, { status: 400 });
  }

  await ensureSellerPlanColumns(env.DB);

  const existing = await env.DB.prepare('SELECT id FROM seller WHERE lower(email) = ? LIMIT 1')
    .bind(email).first();

  if (existing) {
    return Response.json(
      { error: 'Este correo ya está registrado. Iniciá sesión o usá "Recuperar" si olvidaste tu contraseña.' },
      { status: 409 }
    );
  }

  const baseSlug = slugify(body?.slug || name);
  let candidateSlug = baseSlug;
  let counter = 1;
  while (true) {
    const taken = await env.DB.prepare('SELECT id FROM seller WHERE slug = ? LIMIT 1').bind(candidateSlug).first();
    if (!taken) break;
    counter += 1;
    candidateSlug = `${baseSlug}-${counter}`;
  }

  const passwordHash = await hashPassword(password);
  const now = Math.floor(Date.now() / 1000);
  const planEndsAt = now + DEFAULT_TRIAL_DAYS * DAY_SEC;

  let insertRes;
  try {
    insertRes = await env.DB.prepare(
      `INSERT INTO seller (slug, name, city, phone, email, password_hash, approval_status, active, plan_type, plan_ends_at, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', 1, 'trial', ?, ?, ?)`
    ).bind(candidateSlug, name, city, phone, email, passwordHash, planEndsAt, now, now).run();
  } catch {
    insertRes = await env.DB.prepare(
      `INSERT INTO seller (slug, name, phone, email, password_hash, approval_status, active, created_at)
       VALUES (?, ?, ?, ?, ?, 'approved', 1, ?)`
    ).bind(candidateSlug, name, phone, email, passwordHash, now).run();
  }

  const sellerId = Number(insertRes.meta?.last_row_id);
  if (!sellerId) {
    return Response.json({ error: 'No se pudo completar el registro. Intentá de nuevo.' }, { status: 500 });
  }

  const origin = new URL(request.url).origin;

  // 1) Correo de bienvenida con portada al nuevo vendedor
  const welcomeTemplate = buildSellerWelcomeEmail({
    name,
    origin,
    slug: candidateSlug,
    methodLabel: 'Correo y contraseña'
  });
  const welcomeMail = await sendEmail(env, {
    to: email,
    subject: welcomeTemplate.subject,
    html: welcomeTemplate.html
  });

  // 2) Notificación al administrador (sin bloquear al usuario)
  let adminNotified = false;
  const adminEmail = env.ADMIN_EMAIL || env.ALERT_EMAIL || '';
  if (adminEmail) {
    const adminTemplate = buildAdminNewSellerEmail({
      name,
      city,
      phone,
      email,
      slug: candidateSlug,
      origin,
      methodLabel: 'Correo y contraseña'
    });
    const adminMail = await sendEmail(env, {
      to: adminEmail,
      subject: adminTemplate.subject,
      html: adminTemplate.html
    });
    adminNotified = Boolean(adminMail?.sent);
  }

  // 3) Guardar registro en el historial de onboarding
  await logOnboardingEvent(env.DB, {
    sellerId,
    name,
    city,
    phone,
    email,
    slug: candidateSlug,
    method: 'Correo y contraseña',
    welcomeSent: Boolean(welcomeMail?.sent),
    adminNotified,
    createdAt: now
  });

  // 4) Auto-login inmediato
  const headers = { 'Content-Type': 'application/json' };
  let autoLoggedIn = false;
  try {
    const token = await createSessionToken(env, {
      role: 'seller',
      sellerId,
      email,
      name
    });
    headers['Set-Cookie'] = buildSessionCookie(token);
    autoLoggedIn = true;
  } catch {
    autoLoggedIn = false;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      status: 'approved',
      autoLoggedIn,
      sellerId,
      slug: candidateSlug,
      plan_type: 'trial',
      plan_ends_at: planEndsAt,
      welcomeEmailSent: welcomeMail.sent,
      message: '¡Cuenta creada! Ingresando a tu panel...'
    }),
    { status: 201, headers }
  );
}