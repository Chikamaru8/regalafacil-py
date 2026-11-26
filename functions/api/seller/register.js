import {
  buildSessionCookie,
  createSessionToken,
  hashPassword
} from '../admin/_auth.js';
import { sendEmail } from '../admin/_email.js';

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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWelcomeEmailHtml({ name, origin, slug }) {
  const safeName = escapeHtml(name);
  const storeUrl = `${origin}/?v=${encodeURIComponent(slug)}`;
  const panelUrl = `${origin}/admin.html`;

  return `
  <div style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      
      <!-- PORTADA -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#e11d48 100%);padding:32px 24px;text-align:center;color:#ffffff;">
        <div style="display:inline-block;background:rgba(255,255,255,0.16);padding:6px 14px;border-radius:999px;font-size:12px;font-weight:bold;letter-spacing:0.5px;margin-bottom:12px;">
          🎁 REGALÁFÁCIL PY
        </div>
        <h1 style="margin:0;font-size:24px;line-height:1.25;">¡Bienvenido/a, ${safeName}!</h1>
        <p style="margin:10px 0 0;font-size:14px;color:#f1f5f9;">
          Tu tienda ya está activa y lista para recibir consultas directo a tu WhatsApp.
        </p>
      </div>

      <!-- CUERPO -->
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
          Ya podés empezar a cargar tus productos y compartir tu catálogo personalizado con tus clientes.
        </p>

        <!-- ENLACE DIRECTO -->
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#64748b;margin-bottom:6px;">
            Tu enlace directo de tienda
          </div>
          <a href="${storeUrl}" style="font-size:14px;font-weight:bold;color:#e11d48;word-break:break-all;text-decoration:none;">
            ${storeUrl}
          </a>
        </div>

        <!-- 3 PASOS RÁPIDOS -->
        <div style="margin-bottom:24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:bold;color:#0f172a;">Empezá en 3 pasos simples:</p>
          <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>1.</strong> Cargá tus productos con foto y precio desde tu panel.</p>
          <p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>2.</strong> Compartí tu enlace directo en tus Estados de WhatsApp e Instagram.</p>
          <p style="margin:0;font-size:13px;color:#334155;"><strong>3.</strong> Recibí los pedidos directo en tu WhatsApp y llevalos ordenados en tu panel.</p>
        </div>

        <!-- BOTÓN -->
        <div style="text-align:center;">
          <a href="${panelUrl}" style="display:inline-block;background:#e11d48;color:#ffffff;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
            Ir a mi Panel de Vendedor
          </a>
        </div>
      </div>

      <!-- PIE -->
      <div style="background:#f1f5f9;padding:14px 24px;text-align:center;font-size:11px;color:#64748b;">
        RegaláFácil PY · Plataforma de regalos y novedades en Paraguay
      </div>
    </div>
  </div>`;
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

  let insertRes;
  try {
    insertRes = await env.DB.prepare(
      `INSERT INTO seller (slug, name, city, phone, email, password_hash, approval_status, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', 1, ?)`
    ).bind(candidateSlug, name, city, phone, email, passwordHash, now).run();
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
  const welcomeMail = await sendEmail(env, {
    to: email,
    subject: '🎁 ¡Bienvenido/a a RegaláFácil PY! Tu tienda ya está activa',
    html: buildWelcomeEmailHtml({ name, origin, slug: candidateSlug })
  });

  // 2) Aviso informativo al administrador (sin bloquear al usuario)
  const adminEmail = env.ADMIN_EMAIL || env.ALERT_EMAIL || '';
  if (adminEmail) {
    await sendEmail(env, {
      to: adminEmail,
      subject: `Nuevo vendedor activo en RegaláFácil PY: ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
          <h3>Nuevo vendedor registrado (acceso automático)</h3>
          <ul>
            <li><strong>Nombre / Tienda:</strong> ${escapeHtml(name)}</li>
            ${city ? `<li><strong>Ciudad:</strong> ${escapeHtml(city)}</li>` : ''}
            <li><strong>Correo:</strong> ${escapeHtml(email)}</li>
            <li><strong>WhatsApp:</strong> ${escapeHtml(phone)}</li>
            <li><strong>Enlace:</strong> <a href="${origin}/?v=${encodeURIComponent(candidateSlug)}">${origin}/?v=${encodeURIComponent(candidateSlug)}</a></li>
          </ul>
          <p>Podés gestionarlo o pausarlo cuando quieras desde <a href="${origin}/admin.html">tu panel</a>.</p>
        </div>
      `
    });
  }

  // 3) Auto-login inmediato
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
      welcomeEmailSent: welcomeMail.sent,
      message: '¡Cuenta creada! Ingresando a tu panel...'
    }),
    { status: 201, headers }
  );
}