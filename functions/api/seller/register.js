import { hashPassword } from '../admin/_auth.js';
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

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = String(body?.name || '').trim();
  const city = String(body?.city || '').trim().slice(0, 60);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const phone = normalizePhone(body?.phone || '');

  if (name.length < 2) {
    return Response.json({ error: 'Ingresá tu nombre o el nombre de tu tienda' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Ingresá un correo electrónico válido' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }
  if (phone.length < 8) {
    return Response.json({ error: 'Ingresá un número de WhatsApp válido (ej. 5959XXXXXXXX)' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT id, approval_status FROM seller WHERE lower(email) = ? LIMIT 1')
    .bind(email).first();

  if (existing) {
    if (existing.approval_status === 'pending') {
      return Response.json({ error: 'Ya existe una solicitud pendiente con este correo.' }, { status: 409 });
    }
    return Response.json({ error: 'Este correo ya está registrado. Iniciá sesión o recuperá tu contraseña.' }, { status: 409 });
  }

  let baseSlug = slugify(body?.slug || name);
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

  try {
    await env.DB.prepare(
      `INSERT INTO seller (slug, name, city, phone, email, password_hash, approval_status, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)`
    ).bind(candidateSlug, name, city, phone, email, passwordHash, now).run();
  } catch {
    await env.DB.prepare(
      `INSERT INTO seller (slug, name, phone, email, password_hash, approval_status, active, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`
    ).bind(candidateSlug, name, phone, email, passwordHash, now).run();
  }

  const adminEmail = env.ADMIN_EMAIL || env.ALERT_EMAIL || '';
  const origin = new URL(request.url).origin;

  const mailResult = await sendEmail(env, {
    to: adminEmail,
    subject: `Nueva solicitud de vendedor en Regalafacil PY: ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2>Nueva solicitud de acceso de vendedor</h2>
        <p>Un usuario se registró y solicita aprobación para gestionar su catálogo en <strong>Regalafacil PY</strong>:</p>
        <ul>
          <li><strong>Nombre / Tienda:</strong> ${name}</li>
          ${city ? `<li><strong>Ciudad:</strong> ${city}</li>` : ''}
          <li><strong>Correo:</strong> ${email}</li>
          <li><strong>WhatsApp:</strong> ${phone}</li>
          <li><strong>Slug sugerido:</strong> ${candidateSlug}</li>
        </ul>
        <p>Entrá a tu panel de administración para <strong>Aprobar</strong> o <strong>Rechazar</strong> su acceso: <a href="${origin}/admin.html">${origin}/admin.html</a></p>
      </div>
    `
  });

  return Response.json({
    ok: true,
    status: 'pending',
    message: 'Solicitud enviada. Queda pendiente de aprobación del administrador.',
    emailNotified: mailResult.sent
  }, { status: 201 });
}