export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { ref, seller_id, customer_name, customer_phone, note, items } = body;

  if (!ref || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  await env.DB.prepare('INSERT OR IGNORE INTO lead (ref, seller_id, status, customer_name, customer_phone, note) VALUES (?, ?, \'new\', ?, ?, ?)')
    .bind(String(ref).slice(0, 16), seller_id || null, customer_name || null, customer_phone || null, note || null).run();

  const lead = await env.DB.prepare('SELECT id FROM lead WHERE ref = ?').bind(String(ref).slice(0, 16)).first();
  if (lead) {
    for (const item of items) {
      await env.DB.prepare('INSERT OR REPLACE INTO lead_item (lead_id, product_id, product_name, qty, unit_price_gs) VALUES (?, ?, ?, ?, ?)')
        .bind(lead.id, item.product_id || null, item.product_name, Number(item.qty) || 1, Number(item.unit_price_gs) || 0).run();
    }
  }

  return Response.json({ ok: true, ref });
}
