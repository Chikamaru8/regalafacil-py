import { normalizePhone } from './_phone.js';

async function getBusiness(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'business'").first();
  try { return JSON.parse(row?.value || '{}'); } catch { return {}; }
}

export async function onRequestGet({ env }) {
  return Response.json(await getBusiness(env));
}

export async function onRequestPut({ request, env }) {
  let b; try { b = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const name = String(b?.name || '').trim().slice(0, 60);
  const phone = normalizePhone(b?.default_phone);
  if (name.length < 2) return Response.json({ error: 'Escribí el nombre del negocio' }, { status: 400 });
  if (!phone) return Response.json({ error: 'Teléfono inválido. Ejemplo: 0981 123 456' }, { status: 400 });

  const next = { ...(await getBusiness(env)), name, default_phone: phone };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO settings (key, value) VALUES ('business', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(JSON.stringify(next)),
    env.DB.prepare("UPDATE settings SET value = CAST(COALESCE(CAST(value AS INTEGER), 0) + 1 AS TEXT) WHERE key = 'catalog_version'")
  ]);
  return Response.json({ ok: true });
}
