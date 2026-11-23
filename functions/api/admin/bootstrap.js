export async function onRequestGet({ env }) {
  const [
    { results: settingsRows },
    { results: categories },
    { results: tags },
    { results: sellers },
    { results: products },
    { results: leads }
  ] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM settings').all(),
    env.DB.prepare('SELECT id, slug, name, sort_order, active FROM category ORDER BY sort_order ASC, id ASC').all(),
    env.DB.prepare('SELECT id, group_key, slug, label FROM tag ORDER BY id ASC').all(),
    env.DB.prepare('SELECT id, slug, name, phone, active FROM seller ORDER BY id ASC').all(),
    env.DB.prepare(`
      SELECT p.id, p.slug, p.name, p.description, p.price_gs, p.category_id, p.status, p.attributes,
        (SELECT o.offer_price_gs FROM offer o WHERE o.product_id = p.id ORDER BY o.id DESC LIMIT 1) AS offer_price_gs,
        (SELECT o.ends_at FROM offer o WHERE o.product_id = p.id ORDER BY o.id DESC LIMIT 1) AS offer_ends_at,
        (SELECT GROUP_CONCAT(pi.id) FROM product_image pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC) AS image_ids,
        (SELECT GROUP_CONCAT(pt.tag_id) FROM product_tag pt WHERE pt.product_id = p.id) AS tag_ids
      FROM product p
      ORDER BY p.id DESC
    `).all(),
    env.DB.prepare(`
      SELECT l.id, l.ref, l.status, l.customer_name, l.customer_phone, l.note, l.created_at,
        s.name AS seller_name
      FROM lead l
      LEFT JOIN seller s ON s.id = l.seller_id
      ORDER BY l.id DESC
      LIMIT 60
    `).all()
  ]);

  const settings = {};
  for (const row of settingsRows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
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

  return Response.json({
    settings,
    categories,
    tags,
    sellers,
    products: products.map(p => ({
      ...p,
      attributes: JSON.parse(p.attributes || '{}'),
      image_ids: p.image_ids ? p.image_ids.split(',').map(Number) : [],
      tag_ids: p.tag_ids ? p.tag_ids.split(',').map(Number) : []
    })),
    leads: leads.map(l => ({ ...l, items: itemsByLead[l.id] || [] }))
  });
}