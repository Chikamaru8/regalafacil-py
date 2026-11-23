const REF = /^[A-Z0-9]{4,16}$/;

// Registra la intención de compra. Precios, nombres y vendedor se toman de la base: nada de lo que
// manda el navegador se usa como dato confiable.
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const ref = String(b?.ref || '').toUpperCase();
  const items = Array.isArray(b?.items) ? b.items.slice(0, 10) : [];
  if (!REF.test(ref) || !items.length) return Response.json({ error: 'Datos incompletos' }, { status: 400 });

  const ids = [...new Set(items.map((i) => Number(i.product_id)).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return Response.json({ error: 'Datos incompletos' }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const { results: prods } = await env.DB.prepare(
    `SELECT p.id, p.name, p.price_gs,
       (SELECT MIN(o.offer_price_gs) FROM offer o WHERE o.product_id = p.id AND ? BETWEEN o.starts_at AND o.ends_at) AS offer
     FROM product p WHERE p.status = 'active' AND p.id IN (${ids.map(() => '?').join(',')})`
  ).bind(now, ...ids).all();
  const byId = new Map(prods.map((p) => [p.id, p]));

  const lines = [];
  for (const it of items) {
    const p = byId.get(Number(it.product_id));
    if (!p) continue;
    const qty = Math.min(99, Math.max(1, Math.floor(Number(it.qty)) || 1));
    lines.push({ p, qty, unit: p.offer != null && p.offer < p.price_gs ? p.offer : p.price_gs });
  }
  if (!lines.length) return Response.json({ error: 'Producto no disponible' }, { status: 400 });

  const slug = String(b?.seller_slug || '').slice(0, 60);
  const seller = slug ? await env.DB.prepare('SELECT id FROM seller WHERE slug = ? AND active = 1').bind(slug).first() : null;
  const visitor = String(b?.visitor_id || '').slice(0, 40) || null;

  const res = await env.DB.prepare("INSERT OR IGNORE INTO lead (ref, seller_id, status, visitor_id) VALUES (?, ?, 'new', ?)")
    .bind(ref, seller?.id || null, visitor).run();
  if (!res.meta?.changes) return Response.json({ ok: true, ref }); // Ref repetido: no duplica

  const leadId = res.meta.last_row_id;
  await env.DB.batch(lines.map((l) =>
    env.DB.prepare('INSERT OR REPLACE INTO lead_item (lead_id, product_id, product_name, qty, unit_price_gs, list_price_gs) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(leadId, l.p.id, l.p.name, l.qty, l.unit, l.p.price_gs)
  ));
  return Response.json({ ok: true, ref });
}
