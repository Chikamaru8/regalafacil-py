import { getSession } from './_auth.js';

export async function onRequestGet({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const isSeller = session.role === 'seller' && Boolean(session.sellerId);
  const sellerId = isSeller ? Number(session.sellerId) : null;

  const sellersQuery = isSeller
    ? env.DB.prepare(
        'SELECT id, slug, name, city, phone, email, approval_status, active FROM seller WHERE id = ? LIMIT 1'
      ).bind(sellerId)
    : env.DB.prepare(
        'SELECT id, slug, name, city, phone, email, approval_status, active FROM seller ORDER BY CASE WHEN approval_status = "pending" THEN 0 ELSE 1 END, active DESC, name COLLATE NOCASE, id'
      );

  const productsQuery = isSeller
    ? env.DB.prepare(`
        SELECT p.id, p.slug, p.name, p.description, p.price_gs, p.category_id, p.status, p.seller_id, p.attributes,
          (SELECT o.offer_price_gs FROM offer o WHERE o.product_id = p.id ORDER BY o.id DESC LIMIT 1) AS offer_price_gs,
          (SELECT o.ends_at FROM offer o WHERE o.product_id = p.id ORDER BY o.id DESC LIMIT 1) AS offer_ends_at,
          (SELECT GROUP_CONCAT(pt.tag_id) FROM product_tag pt WHERE pt.product_id = p.id) AS tag_ids
        FROM product p
        WHERE p.seller_id = ?
           OR CAST(json_extract(p.attributes, '$.seller_id') AS INTEGER) = ?
        ORDER BY p.id DESC
      `).bind(sellerId, sellerId)
    : env.DB.prepare(`
        SELECT p.id, p.slug, p.name, p.description, p.price_gs, p.category_id, p.status, p.seller_id, p.attributes,
          (SELECT o.offer_price_gs FROM offer o WHERE o.product_id = p.id ORDER BY o.id DESC LIMIT 1) AS offer_price_gs,
          (SELECT o.ends_at FROM offer o WHERE o.product_id = p.id ORDER BY o.id DESC LIMIT 1) AS offer_ends_at,
          (SELECT GROUP_CONCAT(pt.tag_id) FROM product_tag pt WHERE pt.product_id = p.id) AS tag_ids
        FROM product p
        ORDER BY p.id DESC
      `);

  const leadsQuery = isSeller
    ? env.DB.prepare(`
        SELECT l.id, l.ref, l.seller_id, l.status, l.customer_name, l.customer_phone, l.note, l.created_at,
          s.name AS seller_name
        FROM lead l
        LEFT JOIN seller s ON s.id = l.seller_id
        WHERE l.seller_id = ?
        ORDER BY l.id DESC
        LIMIT 60
      `).bind(sellerId)
    : env.DB.prepare(`
        SELECT l.id, l.ref, l.seller_id, l.status, l.customer_name, l.customer_phone, l.note, l.created_at,
          s.name AS seller_name
        FROM lead l
        LEFT JOIN seller s ON s.id = l.seller_id
        ORDER BY l.id DESC
        LIMIT 60
      `);

  const [
    { results: settingsRows },
    { results: categories },
    { results: tags },
    { results: sellers },
    { results: products },
    imgs,
    { results: leads }
  ] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM settings').all(),
    env.DB.prepare('SELECT id, slug, name, sort_order, active FROM category ORDER BY sort_order ASC, id ASC').all(),
    env.DB.prepare('SELECT id, group_key, slug, label FROM tag ORDER BY id ASC').all(),
    sellersQuery.all(),
    productsQuery.all(),
    env.DB.prepare('SELECT id, product_id, color_key FROM product_image ORDER BY product_id, sort_order, id').all(),
    leadsQuery.all()
  ]);

  const settings = {};
  for (const row of settingsRows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  }

  const imagesByProduct = {};
  for (const img of (imgs.results || [])) {
    if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
    imagesByProduct[img.product_id].push({
      id: img.id,
      color_key: img.color_key
    });
  }

  const leadIds = leads.map(l => l.id);
  let itemsByLead = {};
  if (leadIds.length) {
    const { results: items } = await env.DB.prepare(
      `SELECT lead_id, product_name, qty, unit_price_gs FROM lead_item WHERE lead_id IN (${leadIds.map(() => '?').join(',')})`
    ).bind(...leadIds).all();
    for (const it of items) {
      if (!itemsByLead[it.lead_id]) itemsByLead[it.lead_id] = [];
      itemsByLead[it.lead_id].push(it);
    }
  }

  const sessionOut = isSeller
    ? { ...session, slug: sellers[0]?.slug || '' }
    : session;

  return Response.json({
    session: sessionOut,
    settings,
    categories,
    tags,
    sellers,
    products: products.map(p => {
      let attrs = {};
      try {
        attrs = JSON.parse(p.attributes || '{}');
      } catch {
        attrs = {};
      }

      const productImages = imagesByProduct[p.id] || [];

      return {
        ...p,
        attributes: attrs,
        colors: attrs.colors || [],
        images: productImages,
        image_ids: productImages.map(img => img.id),
        tag_ids: p.tag_ids ? p.tag_ids.split(',').map(Number) : []
      };
    }),
    leads: leads.map(l => ({ ...l, items: itemsByLead[l.id] || [] }))
  });
}