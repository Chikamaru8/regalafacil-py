export async function sendEmail(env, { to, subject, html, text }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: 'Falta RESEND_API_KEY en variables de entorno' };
  }
  if (!to) {
    return { sent: false, reason: 'Falta destinatario de correo' };
  }

  const from = env.EMAIL_FROM || 'Regalafacil PY <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { sent: false, reason: `Resend HTTP ${res.status}: ${errText}` };
  }

  const data = await res.json().catch(() => ({}));
  return { sent: true, id: data.id || null };
}