import { getSession } from './_auth.js';
import { normalizePhone } from './_phone.js';
import { sendEmail } from './_email.js';

const DEFAULT_TRIAL_DAYS = 60;
const DAY_SEC = 86400;
const nowSec = () => Math.floor(Date.now() / 1000);

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

async function ensureSellerColumns(env) {
  const alters = [
    "ALTER TABLE seller ADD COLUMN plan_type TEXT DEFAULT 'trial'",
    'ALTER TABLE seller ADD COLUMN plan_ends_at INTEGER',
    'ALTER TABLE seller ADD COLUMN created_at INTEGER',
    'ALTER TABLE seller ADD COLUMN last_login_at INTEGER'
  ];
  for (const sql of alters) {
    try { await env.DB.prepare(sql).run(); } catch {}
  }
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

  const rawPlan = String(b?.plan_type || '').trim().toLowerCase();
  const planType = ['trial', 'paid', 'vip'].includes(rawPlan) ? rawPlan : 'trial';

  let planEndsAt = null;
  if (planType === 'vip') {
    planEndsAt = null;
  } else if (b?.plan_ends_at !== undefined && b?.plan_ends_at !== null && b?.plan_ends_at !== '') {
    const parsed = Number(b.plan_ends_at);
    if (Number.isFinite(parsed) && parsed > 0) planEndsAt = Math.floor(parsed);
  }

  const addDays = Number(b?.add_days) || 0;

  if (name.length < 2) return { error: 'Escribí el nombre del vendedor' };
  if (!phone) return { error: 'Teléfono inválido. Ejemplo: 0981 123 456' };
  if (rawEmail && !email) return { error: 'El correo electrónico no tiene un formato válido' };

  return { v: { name, city, phone, email, approvalStatus, active, planType, planEndsAt, addDays } };
}

export async function onRequestGet({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede gestionar vendedores' }, { status: 403 });

  await ensureSellerColumns(env);

  let results = [];
  try {
    const res = await env.DB.prepare(`
      SELECT
        s.id, s.slug, s.name, s.city, s.phone, s.email,
        s.approval_status, s.active,
        COALESCE(s.plan_type, 'trial') AS plan_type,
        s.plan_ends_at, s.created_at, s.last_login_at,
        (SELECT COUNT(*) FROM product p WHERE p.seller_id = s.id) AS products_count
      FROM seller s
      ORDER BY CASE WHEN s.approval_status = 'pending' THEN 0 ELSE 1 END, s.active DESC, s.name COLLATE NOCASE, s.id
    `).all();
    results = res.results || [];
  } catch {
    const res = await env.DB.prepare(
      "SELECT id, slug, name, city, phone, email, approval_status, active, COALESCE(plan_type, 'trial') AS plan_type, plan_ends_at, created_at, last_login_at FROM seller ORDER BY active DESC, name COLLATE NOCASE, id"
    ).all();
    results = (res.results || []).map((r) => ({ ...r, products_count: 0 }));
  }

  return Response.json({ sellers: results });
}

export async function onRequestPost({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede crear vendedores' }, { status: 403 });

  await ensureSellerColumns(env);

  const { error, v } = clean(await readJson(request));
  if (error) return Response.json({ error }, { status: 400 });

  const now = nowSec();
  const slug = slugify(v.name) + '-' + Math.random().toString(36).slice(2, 6);
  const planEndsAt = v.planType === 'vip'
    ? null
    : (v.planEndsAt || (now + (v.addDays > 0 ? v.addDays : DEFAULT_TRIAL_DAYS) * DAY_SEC));

  const res = await env.DB.prepare(
    'INSERT INTO seller (slug, name, city, phone, email, approval_status, active, plan_type, plan_ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(slug, v.name, v.city, v.phone, v.email, v.approvalStatus, v.active, v.planType, planEndsAt, now).run();

  return Response.json({ ok: true, id: res.meta?.last_row_id, slug });
}

export async function onRequestPut({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede modificar vendedores' }, { status: 403 });

  await ensureSellerColumns(env);

  const b = await readJson(request);
  const id = Number(b?.id);
  const { error, v } = clean(b);
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });
  if (error) return Response.json({ error }, { status: 400 });

  let prevSeller = null;
  try {
    prevSeller = await env.DB.prepare(
      'SELECT id, email, approval_status, slug, plan_type, plan_ends_at, created_at FROM seller WHERE id = ? LIMIT 1'
    ).bind(id).first();
  } catch {}

  if (!prevSeller) return Response.json({ error: 'Vendedor no encontrado' }, { status: 404 });

  const now = nowSec();
  let nextPlanEndsAt = v.planEndsAt;

  if (v.planType === 'vip') {
    nextPlanEndsAt = null;
  } else if (v.addDays > 0) {
    const base = Math.max(now, Number(prevSeller.plan_ends_at) || 0);
    nextPlanEndsAt = base + v.addDays * DAY_SEC;
  } else if (nextPlanEndsAt === null) {
    nextPlanEndsAt = prevSeller.plan_ends_at || (now + DEFAULT_TRIAL_DAYS * DAY_SEC);
  }

  const createdAt = prevSeller.created_at || now;

  const res = await env.DB.prepare(
    'UPDATE seller SET name = ?, city = ?, phone = ?, email = COALESCE(?, email), approval_status = ?, active = ?, plan_type = ?, plan_ends_at = ?, created_at = ? WHERE id = ?'
  ).bind(
    v.name, v.city, v.phone, v.email, v.approvalStatus, v.active,
    v.planType, nextPlanEndsAt, createdAt, id
  ).run();

  if (!res.meta?.changes) return Response.json({ error: 'Vendedor no encontrado' }, { status: 404 });

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

  return Response.json({ ok: true, id, plan_type: v.planType, plan_ends_at: nextPlanEndsAt });
}

export async function onRequestDelete({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (session.role !== 'admin') return Response.json({ error: 'Solo el administrador puede eliminar vendedores' }, { status: 403 });

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });

  // Desvincular productos y pedidos antes de borrar para evitar bloqueos de clave foránea
  try { await env.DB.prepare('UPDATE product SET seller_id = NULL WHERE seller_id = ?').bind(id).run(); } catch {}
  try { await env.DB.prepare('UPDATE lead SET seller_id = NULL WHERE seller_id = ?').bind(id).run(); } catch {}

  const res = await env.DB.prepare('DELETE FROM seller WHERE id = ?').bind(id).run();
  if (!res.meta?.changes) return Response.json({ error: 'Vendedor no encontrado' }, { status: 404 });

  return Response.json({ ok: true, id });
}