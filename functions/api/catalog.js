const TTL = 60; // segundos: los cambios del admin tardan hasta ~1-2 min en verse en la tienda

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const slug = (new URL(request.url).searchParams.get('v') || '').slice(0, 60);
  const now = Math.floor(Date.now() / 1000);

  // Una sola ida a la base. Sin link de vendedor válido, seller = null (la tienda usa el número del administrador).
  const [st, sel, allSellers, cat, tag, prod, imgs] = await env.DB.batch([
    env.DB.prepare('SELECT key, value FROM settings'),
    env.DB.prepare('SELECT id, slug, name, city, phone FROM seller WHERE slug = ? AND active = 1').bind(slug),
    env.DB.prepare('SELECT id, slug, name, city, phone FROM seller WHERE active = 1 ORDER BY name COLLATE NOCASE, id'),
    env.DB.prepare('SELECT id, slug, name FROM category WHERE active = 1 ORDER BY sort_order, id'),
    env.DB.prepare('SELECT id, group_key, slug, label FROM tag ORDER BY id'),
    env.DB.prepare(`
      SELECT p.id, p.slug, p.name, p.description, p.price_gs, p.category_id, p.attributes,
        (SELECT MIN(o.offer_price_gs) FROM offer o WHERE o.product_id = p.id AND ?1 BETWEEN o.starts_at AND o.ends_at) AS offer_price_gs,
        (SELECT o.ends_at FROM offer o WHERE o.product_id = p.id AND ?1 BETWEEN o.starts_at AND o.ends_at ORDER BY o.offer_price_gs LIMIT 1) AS offer_ends_at,
        (SELECT GROUP_CONCAT(tag_id) FROM product_tag WHERE product_id = p.id) AS tag_ids
      FROM product p WHERE p.status = 'active' ORDER BY p.id DESC`).bind(now),
    env.DB.prepare('SELECT id, product_id, color_key FROM product_image ORDER BY product_id, sort_order, id')
  ]);

  const settings = {};
  for (const r of st.results) { try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; } }
  const parse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
  const nums = (s) => (s ? s.split(',').map(Number) : []);

  const sellersList = allSellers.results || [];
  const citiesList = Array.from(
    new Set(
      sellersList
        .map((s) => String(s.city || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));

  // Agrupar las imágenes por producto mapeando ID y color_key
  const imagesByProduct = {};
  for (const img of imgs.results) {
    if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
    imagesByProduct[img.product_id].push({
      id: img.id,
      color_key: img.color_key
    });
  }

  const body = JSON.stringify({
    settings,
    seller: sel.results[0] || null,
    sellers: sellersList,
    cities: citiesList,
    categories: cat.results,
    tags: tag.results,
    products: prod.results.map((p) => {
      const attrs = parse(p.attributes);
      const productImages = imagesByProduct[p.id] || [];
      return {
        ...p,
        attributes: attrs,
        colors: attrs.colors || [],
        images: productImages,
        image_ids: productImages.map(img => img.id),
        tag_ids: nums(p.tag_ids)
      };
    })
  });

  const res = new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL}` } });
  waitUntil(cache.put(request, res.clone()));
  return res;
}