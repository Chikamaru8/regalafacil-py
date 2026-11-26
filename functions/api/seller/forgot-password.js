import { hashPassword } from '../admin/_auth.js';
import { sendEmail } from '../admin/_email.js';

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Ingresá un correo electrónico válido' }, { status: 400 });
  }

  const seller = await env.DB.prepare(
    'SELECT id, name, email, approval_status FROM seller WHERE lower(email) = ? LIMIT 1'
  ).bind(email).first();

  if (!seller) {
    return Response.json({
      ok: true,
      message: 'Si el correo está registrado, enviamos las instrucciones de recuperación.'
    });
  }

  const tempPass = generateTempPassword();
  const passwordHash = await hashPassword(tempPass);
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    'UPDATE seller SET password_hash = ?, reset_token = NULL, reset_expires = ? WHERE id = ?'
  ).bind(passwordHash, now + 3600, seller.id).run();

  const origin = new URL(request.url).origin;

  await sendEmail(env, {
    to: seller.email,
    subject: 'Recuperación de contraseña · Regalafacil PY',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2>Recuperación de contraseña</h2>
        <p>Hola <strong>${seller.name}</strong>, generamos una contraseña temporal para tu cuenta en <strong>Regalafacil PY</strong>:</p>
        <p style="font-size: 18px; font-weight: bold; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; display: inline-block;">${tempPass}</p>
        <p>Iniciá sesión aquí: <a href="${origin}/admin.html">${origin}/admin.html</a></p>
        <p style="font-size: 12px; color: #64748b;">Si no solicitaste este cambio, avisale al administrador.</p>
      </div>
    `
  });

  return Response.json({
    ok: true,
    message: 'Si el correo está registrado, enviamos una nueva contraseña temporal a tu casilla.'
  });
}