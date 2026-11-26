export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|li|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

export async function sendEmail(env, { to, subject, html, text }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: 'Falta RESEND_API_KEY en variables de entorno' };
  }
  if (!to) {
    return { sent: false, reason: 'Falta destinatario de correo' };
  }

  const from = env.EMAIL_FROM || 'RegaláFácil PY <onboarding@resend.dev>';
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) {
    return { sent: false, reason: 'Destinatario vacío' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html,
      text: text || htmlToPlainText(html)
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { sent: false, reason: `Resend HTTP ${res.status}: ${errText}` };
  }

  const data = await res.json().catch(() => ({}));
  return { sent: true, id: data.id || null };
}

export function buildSellerWelcomeEmail({ name, origin, slug, methodLabel = 'Correo y contraseña' }) {
  const safeName = escapeHtml(name || 'Vendedor/a');
  const safeMethod = escapeHtml(methodLabel);
  const storeUrl = `${origin}/?v=${encodeURIComponent(slug || '')}`;
  const panelUrl = `${origin}/admin.html`;

  const subject = '🎁 ¡Bienvenido/a a RegaláFácil PY! Tu tienda ya está activa';

  const html = `
  <div style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,23,42,0.05);">

      <!-- PORTADA -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#be123c 55%,#e11d48 100%);padding:32px 24px;text-align:center;color:#ffffff;">
        <div style="display:inline-block;background:rgba(255,255,255,0.16);padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.4px;margin-bottom:12px;">
          🎁 REGALÁFÁCIL PY · PARAGUAY
        </div>
        <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:800;">
          ¡Bienvenido/a, ${safeName}!
        </h1>
        <p style="margin:10px auto 0;max-width:440px;font-size:14px;line-height:1.5;color:#ffe4e6;">
          Tu cuenta ya está activa. Ya podés sumar tus productos y empezar a recibir consultas directo a tu WhatsApp.
        </p>
      </div>

      <!-- CONTENIDO -->
      <div style="padding:26px 24px;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155;">
          Qué alegría tenerte en <strong>RegaláFácil PY</strong>. Armamos este espacio para que mostrar tus regalos y novedades sea rápido, simple y sin vueltas.
        </p>

        <!-- ENLACE DE TIENDA -->
        <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:14px 16px;margin-bottom:22px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#be123c;margin-bottom:6px;">
            🔗 Tu enlace directo de tienda
          </div>
          <a href="${escapeHtml(storeUrl)}" style="font-size:14px;font-weight:700;color:#9f1239;text-decoration:none;word-break:break-all;">
            ${escapeHtml(storeUrl)}
          </a>
          <div style="font-size:12px;color:#64748b;margin-top:6px;">
            Compartilo en tus estados de WhatsApp, Instagram o grupos cuando cargues tus productos.
          </div>
        </div>

        <!-- PASOS INICIALES -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0f172a;">
            🚀 Cómo arrancar en 3 pasos:
          </p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#334155;">
            <strong>1. Cargá tu primer producto:</strong> subí foto, precio en Guaraníes y una descripción breve desde tu panel.
          </p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#334155;">
            <strong>2. Difundí tu catálogo:</strong> enviá tu enlace directo para que tus clientes vean lo que tenés disponible.
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#334155;">
            <strong>3. Cerrá ventas por WhatsApp:</strong> recibí los pedidos directo en tu celular y llevá el seguimiento en tu panel.
          </p>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:14px;">
          <a href="${escapeHtml(panelUrl)}" style="display:inline-block;background:#e11d48;color:#ffffff;font-weight:700;font-size:14px;padding:13px 26px;border-radius:10px;text-decoration:none;">
            Entrar a mi Panel de Vendedor
          </a>
        </div>

        <p style="margin:16px 0 0;text-align:center;font-size:11.5px;color:#94a3b8;">
          Método de alta: ${safeMethod}
        </p>
      </div>

      <!-- FOOTER -->
      <div style="background:#f1f5f9;padding:14px 20px;text-align:center;font-size:11.5px;color:#64748b;border-top:1px solid #e2e8f0;">
        <strong>RegaláFácil PY</strong> · Catálogo de regalos y novedades en Paraguay
      </div>
    </div>
  </div>`;

  return { subject, html, storeUrl, panelUrl };
}

export function buildAdminNewSellerEmail({
  name,
  city,
  phone,
  email,
  slug,
  origin,
  methodLabel = 'Correo y contraseña'
}) {
  const safeName = escapeHtml(name || 'Sin nombre');
  const safeCity = escapeHtml(city || 'No especificada');
  const safePhone = escapeHtml(phone || 'No especificado');
  const safeEmail = escapeHtml(email || 'No especificado');
  const safeSlug = escapeHtml(slug || '');
  const safeMethod = escapeHtml(methodLabel);
  const storeUrl = `${origin}/?v=${encodeURIComponent(slug || '')}`;
  const panelUrl = `${origin}/admin.html`;
  const fechaPy = new Date().toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    dateStyle: 'short',
    timeStyle: 'short'
  });

  const subject = `🆕 Nuevo vendedor onboardeado: ${name}`;

  const html = `
  <div style="margin:0;padding:20px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#0f172a;color:#ffffff;padding:18px 22px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#fda4af;font-weight:700;">
          RegaláFácil PY · Alerta de Onboarding
        </div>
        <h2 style="margin:6px 0 0;font-size:19px;">Nuevo vendedor registrado</h2>
      </div>

      <div style="padding:20px 22px;font-size:13.5px;line-height:1.6;color:#334155;">
        <p style="margin:0 0 12px;">Se sumó un nuevo usuario con acceso inmediato al panel:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:5px 0;color:#64748b;width:130px;"><strong>Tienda / Nombre:</strong></td><td style="padding:5px 0;">${safeName}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;"><strong>Correo:</strong></td><td style="padding:5px 0;">${safeEmail}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;"><strong>WhatsApp:</strong></td><td style="padding:5px 0;">${safePhone}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;"><strong>Ciudad / Zona:</strong></td><td style="padding:5px 0;">${safeCity}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;"><strong>Enlace slug:</strong></td><td style="padding:5px 0;">${safeSlug}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;"><strong>Vía de ingreso:</strong></td><td style="padding:5px 0;">${safeMethod}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;"><strong>Fecha (PY):</strong></td><td style="padding:5px 0;">${escapeHtml(fechaPy)}</td></tr>
        </table>

        <p style="margin:0;">
          <a href="${escapeHtml(storeUrl)}" style="color:#e11d48;font-weight:700;text-decoration:none;">Ver tienda del vendedor</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(panelUrl)}" style="color:#0f172a;font-weight:700;text-decoration:none;">Abrir Panel Admin</a>
        </p>
      </div>
    </div>
  </div>`;

  return { subject, html, fechaPy };
}