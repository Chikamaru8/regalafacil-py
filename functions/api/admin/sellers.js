import { getSession } from './_auth.js';
import { normalizePhone } from './_phone.js';
import { sendEmail } from './_email.js';

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'vendedor';
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(b) {
  const name = String(b?.name || '').trim().slice(0, 60);
  const city = String(b?.city || '').trim().slice(0, 60);
  const phone = normalizePhone(b?.phone);
  const rawEmail = String(b?.email || '').trim().toLowerCase().slice(0, 120);
  const email = rawEmail && isValidEmail(rawEmail) ? rawEmail : null;

  const rawStatus = String(b?.approval_status || '').trim().toLowerCase();
  const hasExplicitActive = b?.active !== undefined && b?.active !== null;
  let active = hasExplicitActive ? (b.active === 0 || b.active === false || b.active === '0' ? 0 : 1) : 1;

  let approvalStatus = ['pending', 'approved', 'rejected'].includes(rawStatus)
    ? rawStatus
    : (active === 1 ? 'approved' : 'pending');

  if (approvalStatus === 'approved' && !hasExplicitActive) {
    active = 1;
  } else if (approvalStatus === 'rejected' && !hasExplicitActive) {
    active = 0;
  }

  if (name.length < 2) return { error: 'Escribí el nombre del vendedor' };
  if (!phone) return { error: 'Teléfono inválido. Ejemplo: 0981 123 456' };
  if (rawEmail && !email) return { error: 'El correo electrónico no tiene un formato válido' };

  return { v: { name, city, phone, email, approvalStatus, active } };
}

export async function onRequestGet({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede gestionar vendedores' }, { status: 403 });

  let results = [];
  try {
    const res = await env.DB.prepare(
      'SELECT id, slug, name, city, phone, email, approval_status, active FROM seller ORDER BY CASE WHEN approval_status = "pending" THEN 0 ELSE 1 END, active DESC, name COLLATE NOCASE, id'
    ).all();
    results = res.results || [];
  } catch {
    const res = await env.DB.prepare(
      'SELECT id, slug, name, city, phone, active FROM seller ORDER BY active DESC, name COLLATE NOCASE, id'
    ).all();
    results = (res.results || []).map(r => ({ ...r, email: null, approval_status: r.active ? 'approved' : 'pending' }));
  }

  return Response.json({ sellers: results });
}

export async function onRequestPost({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede crear vendedores' }, { status: 403 });

  const { error, v } = clean(await readJson(request));
  if (error) return Response.json({ error }, { status: 400 });

  const slug = slugify(v.name) + '-' + Math.random().toString(36).slice(2, 6);
  let res;
  try {
    res = await env.DB.prepare(
      'INSERT INTO seller (slug, name, city, phone, email, approval_status, active) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(slug, v.name, v.city, v.phone, v.email, v.approvalStatus, v.active).run();
  } catch {
    res = await env.DB.prepare(
      'INSERT INTO seller (slug, name, city, phone, active) VALUES (?, ?, ?, ?, ?)'
    ).bind(slug, v.name, v.city, v.phone, v.active).run();
  }

  return Response.json({ ok: true, id: res.meta?.last_row_id, slug });
}

export async function onRequestPut({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede modificar vendedores' }, { status: 403 });

  const b = await readJson(request);
  const id = Number(b?.id);
  const { error, v } = clean(b);
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });
  if (error) return Response.json({ error }, { status: 400 });

  let prevSeller = null;
  try {
    prevSeller = await env.DB.prepare('SELECT id, email, approval_status, slug FROM seller WHERE id = ? LIMIT 1').bind(id).first();
  } catch {}

  let changes = 0;
  try {
    const res = await env.DB.prepare(
      'UPDATE seller SET name = ?, city = ?, phone = ?, email = COALESCE(?, email), approval_status = ?, active = ? WHERE id = ?'
    ).bind(v.name, v.city, v.phone, v.email, v.approvalStatus, v.active, id).run();
    changes = res.meta?.changes || 0;
  } catch {
    const res = await env.DB.prepare(
      'UPDATE seller SET name = ?, city = ?, phone = ?, active = ? WHERE id = ?'
    ).bind(v.name, v.city, v.phone, v.active, id).run();
    changes = res.meta?.changes || 0;
  }

  if (!changes) return Response.json({ error: 'Vendedor no encontrado' }, { status: 404 });

  const targetEmail = v.email || prevSeller?.email;
  const wasPending = prevSeller?.approval_status === 'pending';
  const nowApproved = v.approvalStatus === 'approved' && v.active === 1;
  const origin = new URL(request.url).origin;

  if (wasPending && nowApproved && targetEmail) {
    await sendEmail(env, {
      to: targetEmail,
      subject: '¡Tu acceso a Regalafacil PY fue aprobado!',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2>¡Cuenta aprobada en Regalafacil PY!</h2>
          <p>Hola <strong>${v.name}</strong>, el administrador aprobó tu solicitud de acceso.</p>
          <p>Ya podés iniciar sesión con tu correo y contraseña para cargar y gestionar tus productos: <a href="${origin}/admin.html">${origin}/admin.html</a></p>
        </div>
      `
    });
  }

  return Response.json({ ok: true, id });
}

export async function onRequestDelete({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede eliminar vendedores' }, { status: 403 });

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });

  const res = await env.DB.prepare('DELETE FROM seller WHERE id = ?').bind(id).run();
  if (!res.meta?.changes) return Response.json({ error: 'Vendedor no encontrado' }, { status: 404 });

  return Response.json({ ok: true, id });
}