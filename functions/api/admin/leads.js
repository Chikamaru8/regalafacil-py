import { getSession } from './_auth.js';

const ALLOWED = ['new', 'chatting', 'sold', 'lost'];

async function canAccessLead(env, leadId, session) {
  if (!session) return { ok: false, status: 401, error: 'No autorizado' };
  if (session.role === 'admin') return { ok: true };
  const row = await env.DB.prepare('SELECT id, seller_id FROM lead WHERE id = ? LIMIT 1').bind(leadId).first();
  if (!row) return { ok: false, status: 404, error: 'Pedido no encontrado' };
  if (Number(row.seller_id) !== Number(session.sellerId)) {
    return { ok: false, status: 403, error: 'Solo podés gestionar los pedidos de tu tienda' };
  }
  return { ok: true };
}

export async function onRequestGet({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));

  if (id) {
    const access = await canAccessLead(env, id, session);
    if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

    const lead = await env.DB.prepare(
      `SELECT l.id, l.ref, l.seller_id, s.name AS seller_name, l.status,
              l.customer_name, l.customer_phone, l.note, l.created_at, l.updated_at
         FROM lead l
         LEFT JOIN seller s ON s.id = l.seller_id
        WHERE l.id = ?
        LIMIT 1`
    ).bind(id).first();

    const { results: items } = await env.DB.prepare(
      'SELECT product_id, product_name, qty, unit_price_gs FROM lead_item WHERE lead_id = ?'
    ).bind(id).all();

    return Response.json({ lead: { ...lead, items: items || [] } });
  }

  const query = session.role === 'admin'
    ? `SELECT l.id, l.ref, l.seller_id, s.name AS seller_name, l.status,
              l.customer_name, l.customer_phone, l.note, l.created_at, l.updated_at
         FROM lead l
         LEFT JOIN seller s ON s.id = l.seller_id
        ORDER BY l.created_at DESC, l.id DESC`
    : `SELECT l.id, l.ref, l.seller_id, s.name AS seller_name, l.status,
              l.customer_name, l.customer_phone, l.note, l.created_at, l.updated_at
         FROM lead l
         LEFT JOIN seller s ON s.id = l.seller_id
        WHERE l.seller_id = ?
        ORDER BY l.created_at DESC, l.id DESC`;

  const stmt = session.role === 'admin'
    ? env.DB.prepare(query)
    : env.DB.prepare(query).bind(Number(session.sellerId));

  const { results } = await stmt.all();
  return Response.json({ leads: results || [] });
}

export async function onRequestPut({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });

  let b;
  try { b = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const id = Number(b?.id);
  const status = String(b?.status || '').trim().toLowerCase();
  if (!id || !ALLOWED.includes(status)) {
    return Response.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const access = await canAccessLead(env, id, session);
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const res = await env.DB.prepare(
    "UPDATE lead SET status = ?, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE id = ?"
  ).bind(status, id).run();

  if (!res.meta?.changes) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  return Response.json({ ok: true, id, status });
}

export async function onRequestDelete({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });

  const access = await canAccessLead(env, id, session);
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const [, delLead] = await env.DB.batch([
    env.DB.prepare('DELETE FROM lead_item WHERE lead_id = ?').bind(id),
    env.DB.prepare('DELETE FROM lead WHERE id = ?').bind(id)
  ]);

  if (!delLead.meta?.changes) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  return Response.json({ ok: true, id });
}