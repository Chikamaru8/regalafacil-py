import { getSession } from '../admin/_auth.js';
import { sendEmail } from '../admin/_email.js';

const DAY_SEC = 86400;
const RENEW_DAYS = 30;
const SUBSCRIPTION_AMOUNT_GS = 30000;

async function ensureTables(db) {
  const alters = [
    "ALTER TABLE seller ADD COLUMN plan_type TEXT DEFAULT 'trial'",
    'ALTER TABLE seller ADD COLUMN plan_ends_at INTEGER',
    'ALTER TABLE seller ADD COLUMN created_at INTEGER',
    'ALTER TABLE seller ADD COLUMN last_login_at INTEGER'
  ];
  for (const sql of alters) {
    try { await db.prepare(sql).run(); } catch {}
  }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS seller_payment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      amount_gs INTEGER NOT NULL DEFAULT 30000,
      days_added INTEGER NOT NULL DEFAULT 30,
      receipt_mime TEXT,
      receipt_data BLOB,
      created_at INTEGER NOT NULL
    )
  `).run();
}

export async function onRequestPost({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session || session.role !== 'seller' || !session.sellerId) {
    return Response.json({ error: 'Solo vendedores autenticados pueden registrar pagos.' }, { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Debés enviar la imagen del comprobante.' }, { status: 400 });
  }

  const file = formData.get('receipt');
  if (!file || typeof file.arrayBuffer !== 'function' || file.size === 0) {
    return Response.json({ error: 'Seleccioná la foto o captura de tu comprobante de pago.' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ error: 'La imagen es muy pesada (máximo 2 MB).' }, { status: 400 });
  }

  await ensureTables(env.DB);

  const sellerId = Number(session.sellerId);
  const seller = await env.DB.prepare(
    'SELECT id, name, email, phone, plan_type, plan_ends_at FROM seller WHERE id = ? LIMIT 1'
  ).bind(sellerId).first();

  if (!seller) {
    return Response.json({ error: 'Cuenta de vendedor no encontrada.' }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);
  const baseEnds = Math.max(now, Number(seller.plan_ends_at) || 0);
  const newEndsAt = baseEnds + RENEW_DAYS * DAY_SEC;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = String(file.type || 'image/jpeg').slice(0, 60);

  // 1) Guardar comprobante en D1
  const payRes = await env.DB.prepare(
    'INSERT INTO seller_payment (seller_id, amount_gs, days_added, receipt_mime, receipt_data, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(sellerId, SUBSCRIPTION_AMOUNT_GS, RENEW_DAYS, mime, bytes, now).run();

  const paymentId = payRes.meta?.last_row_id || null;

  // 2) Activar +30 días al vendedor
  await env.DB.prepare(
    "UPDATE seller SET plan_type = 'paid', plan_ends_at = ?, active = 1 WHERE id = ?"
  ).bind(newEndsAt, sellerId).run();

  // 3) Enviar correo de trazabilidad al administrador
  const adminEmail = env.ADMIN_EMAIL || env.ALERT_EMAIL || 'changova@gmail.com';
  const fechaVenc = new Date(newEndsAt * 1000).toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  if (adminEmail) {
    await sendEmail(env, {
      to: adminEmail,
      subject: `Pago de suscripción recibido — ${seller.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin-bottom:8px;">💳 Nuevo pago de suscripción en RegaláFácil PY</h2>
          <p>Un vendedor subió su comprobante de pago y el sistema le acreditó automáticamente <strong>+${RENEW_DAYS} días</strong>.</p>
          <ul style="background:#f8fafc;padding:14px 20px;border-radius:10px;border:1px solid #e2e8f0;list-style:none;">
            <li><strong>Negocio / Tienda:</strong> ${seller.name}</li>
            <li><strong>Correo:</strong> ${seller.email || 'Sin correo'}</li>
            <li><strong>WhatsApp:</strong> ${seller.phone || 'Sin teléfono'}</li>
            <li><strong>Monto esperado:</strong> Gs. ${SUBSCRIPTION_AMOUNT_GS.toLocaleString('es-PY')}</li>
            <li><strong>Nuevo vencimiento:</strong> ${fechaVenc}</li>
            <li><strong>ID de comprobante:</strong> #${paymentId || '-'}</li>
          </ul>
          <p style="font-size:12px;color:#64748b;">Verificá el ingreso en tu cuenta (Alias 4056694). Si hubiera algún inconveniente, podés suspender la cuenta desde el panel de Vendedores.</p>
        </div>
      `
    });
  }

  return Response.json({
    ok: true,
    payment_id: paymentId,
    plan_type: 'paid',
    plan_ends_at: newEndsAt,
    message: `¡Comprobante recibido! Sumamos +${RENEW_DAYS} días a tu suscripción (válida hasta el ${fechaVenc}).`
  });
}