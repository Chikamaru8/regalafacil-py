const TTL = 60; // segundos: los cambios del admin tardan hasta ~1-2 min en verse en la tienda

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const slug = (new URL(request.url).searchParams.get('v') || '').slice(0, 60);
  const now = Math.floor(Date.now() / 1000);

  // Una sola ida a la base. Sin link de vendedor válido, seller = null (la tienda usa el número del administrador).
  const [st, sel, cat, tag, prod] = await env.DB.batch([
    env.DB.prepare('SELECT key, value FROM settings'),
    env.DB.prepare('SELECT id, slug, name, phone FROM seller WHERE slug = ? AND active = 1').bind(slug),
    env.DB.prepare('SELECT id, slug, name FROM category WHERE active = 1 ORDER BY sort_order, id'),
    env.DB.prepare('SELECT id, group_key, slug, label FROM tag ORDER BY id'),
    env.DB.prepare(`
      SELECT p.id, p.slug, p.name, p.description, p.price_gs, p.category_id, p.attributes,
        (SELECT MIN(o.offer_price_gs) FROM offer o WHERE o.product_id = p.id AND ?1 BETWEEN o.starts_at AND o.ends_at) AS offer_price_gs,
        (SELECT o.ends_at FROM offer o WHERE o.product_id = p.id AND ?1 BETWEEN o.starts_at AND o.ends_at ORDER BY o.offer_price_gs LIMIT 1) AS offer_ends_at,
        (SELECT GROUP_CONCAT(id) FROM (SELECT id FROM product_image WHERE product_id = p.id ORDER BY sort_order, id)) AS image_ids,
        (SELECT GROUP_CONCAT(tag_id) FROM product_tag WHERE product_id = p.id) AS tag_ids
      FROM product p WHERE p.status = 'active' ORDER BY p.id DESC`).bind(now)
  ]);

  const settings = {};
  for (const r of st.results) { try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; } }
  const parse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
  const nums = (s) => (s ? s.split(',').map(Number) : []);

  const body = JSON.stringify({
    settings,
    seller: sel.results[0] || null,
    categories: cat.results,
    tags: tag.results,
    products: prod.results.map((p) => ({ ...p, attributes: parse(p.attributes), image_ids: nums(p.image_ids), tag_ids: nums(p.tag_ids) }))
  });
  const res = new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL}` } });
  waitUntil(cache.put(request, res.clone()));
  return res;
}
