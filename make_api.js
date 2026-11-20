const fs = require('fs');

fs.writeFileSync('functions/api/catalog.js', `export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sellerSlug = url.searchParams.get('v');
  const now = Math.floor(Date.now() / 1000);

  const { results: settingsRows } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of settingsRows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  }

  let seller = null;
  if (sellerSlug) {
    seller = await env.DB.prepare('SELECT id, slug, name, phone FROM seller WHERE slug = ? AND active = 1').bind(sellerSlug).first();
  }
  if (!seller) {
    seller = await env.DB.prepare('SELECT id, slug, name, phone FROM seller WHERE active = 1 ORDER BY id ASC LIMIT 1').first();
  }

  const { results: categories } = await env.DB.prepare('SELECT id, slug, name FROM category WHERE active = 1 ORDER BY sort_order ASC, id ASC').all();
  const { results: tags } = await env.DB.prepare('SELECT id, group_key, slug, label FROM tag ORDER BY id ASC').all();

  const { results: products } = await env.DB.prepare(\`
    SELECT p.id, p.slug, p.name, p.description, p.price_gs, p.category_id, p.attributes,
      (SELECT MIN(o.offer_price_gs) FROM offer o WHERE o.product_id = p.id AND ? BETWEEN o.starts_at AND o.ends_at) AS offer_price_gs,
      (SELECT o.ends_at FROM offer o WHERE o.product_id = p.id AND ? BETWEEN o.starts_at AND o.ends_at ORDER BY o.offer_price_gs ASC LIMIT 1) AS offer_ends_at,
      (SELECT GROUP_CONCAT(pi.id) FROM product_image pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC) AS image_ids,
      (SELECT GROUP_CONCAT(pt.tag_id) FROM product_tag pt WHERE pt.product_id = p.id) AS tag_ids
    FROM product p WHERE p.status = 'active' ORDER BY p.id DESC
  \`).bind(now, now).all();

  const formattedProducts = products.map((p) => ({
    ...p,
    attributes: JSON.parse(p.attributes || '{}'),
    image_ids: p.image_ids ? p.image_ids.split(',').map(Number) : [],
    tag_ids: p.tag_ids ? p.tag_ids.split(',').map(Number) : []
  }));

  return Response.json({ settings, seller, categories, tags, products: formattedProducts });
}
`);

fs.writeFileSync('functions/api/image/[id].js', `export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return new Response('Not found', { status: 404 });

  const row = await env.DB.prepare('SELECT mime, data FROM product_image WHERE id = ?').bind(id).first();
  if (!row || !row.data) return new Response('Image not found', { status: 404 });

  return new Response(new Uint8Array(row.data), {
    headers: {
      'Content-Type': row.mime || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
`);

fs.writeFileSync('functions/api/leads.js', `export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { ref, seller_id, customer_name, customer_phone, note, items } = body;

  if (!ref || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  await env.DB.prepare('INSERT OR IGNORE INTO lead (ref, seller_id, status, customer_name, customer_phone, note) VALUES (?, ?, \\'new\\', ?, ?, ?)')
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
`);

console.log('Archivos creados OK');