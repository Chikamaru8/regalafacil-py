// Estados válidos según el esquema de la base (CHECK en la tabla lead)
const ALLOWED = ['new', 'chatting', 'sold', 'lost'];

export async function onRequestPut({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const id = Number(b?.id);
  const status = String(b?.status || '');
  if (!id || !ALLOWED.includes(status)) {
    return Response.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const res = await env.DB.prepare(
    "UPDATE lead SET status = ?, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE id = ?"
  ).bind(status, id).run();

  if (!res.meta?.changes) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  return Response.json({ ok: true });
}
