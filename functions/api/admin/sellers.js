import { normalizePhone } from './_phone.js';

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'vendedor';
}
async function readJson(request) { try { return await request.json(); } catch { return null; } }

function clean(b) {
  const name = String(b?.name || '').trim().slice(0, 60);
  const city = String(b?.city || '').trim().slice(0, 60);
  const phone = normalizePhone(b?.phone);
  if (name.length < 2) return { error: 'Escribí el nombre del vendedor' };
  if (!phone) return { error: 'Teléfono inválido. Ejemplo: 0981 123 456' };
  return { v: { name, city, phone, active: b?.active === 0 || b?.active === false ? 0 : 1 } };
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, slug, name, city, phone, active FROM seller ORDER BY active DESC, name COLLATE NOCASE, id'
  ).all();
  return Response.json({ sellers: results });
}

export async function onRequestPost({ request, env }) {
  const { error, v } = clean(await readJson(request));
  if (error) return Response.json({ error }, { status: 400 });
  // El slug es el link del vendedor: se crea una vez y no vuelve a cambiar.
  const slug = slugify(v.name) + '-' + Math.random().toString(36).slice(2, 6);
  const res = await env.DB.prepare('INSERT INTO seller (slug, name, city, phone, active) VALUES (?, ?, ?, ?, ?)')
    .bind(slug, v.name, v.city, v.phone, v.active).run();
  return Response.json({ ok: true, id: res.meta?.last_row_id, slug });
}

export async function onRequestPut({ request, env }) {
  const b = await readJson(request);
  const id = Number(b?.id);
  const { error, v } = clean(b);
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });
  if (error) return Response.json({ error }, { status: 400 });
  const res = await env.DB.prepare('UPDATE seller SET name = ?, city = ?, phone = ?, active = ? WHERE id = ?')
    .bind(v.name, v.city, v.phone, v.active, id).run();
  if (!res.meta?.changes) return Response.json({ error: 'Vendedor no encontrado' }, { status: 404 });
  return Response.json({ ok: true });
}
