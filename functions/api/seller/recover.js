import { hashPassword } from '../admin/_auth.js';
import { sendEmail } from '../admin/_email.js';

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

  const email = String(body?.email || '').trim().toLowerCase().slice(0, 120);
  const phone = normalizePhone(body?.phone || '');
  const newPassword = String(body?.password || '');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Ingresá un correo electrónico válido' }, { status: 400 });
  }
  if (phone.length < 8) {
    return Response.json({ error: 'Ingresá un número de WhatsApp válido' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return Response.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const seller = await env.DB.prepare(
    'SELECT id, name, email, phone, active FROM seller WHERE lower(email) = ? LIMIT 1'
  ).bind(email).first();

  const storedPhone = normalizePhone(seller?.phone || '');

  if (!seller || !storedPhone || storedPhone !== phone) {
    return Response.json(
      { error: 'El correo y el número de WhatsApp no coinciden con ninguna cuenta registrada' },
      { status: 404 }
    );
  }

  if (Number(seller.active) === 0) {
    return Response.json(
      { error: 'Esta cuenta se encuentra inactiva. Contactá al administrador.' },
      { status: 403 }
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE seller SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, seller.id)
    .run();

  const adminEmail = env.ADMIN_EMAIL || env.ALERT_EMAIL || '';
  if (adminEmail) {
    await sendEmail(env, {
      to: adminEmail,
      subject: `Cambio de contraseña: ${seller.name}`,
      html: `<p>El vendedor <strong>${seller.name}</strong> (${seller.email}, tel: ${seller.phone}) actualizó su contraseña validando correo y WhatsApp.</p>`
    });
  }

  return Response.json({
    ok: true,
    message: 'Contraseña actualizada. Ya podés ingresar con tu nueva clave.'
  });
}