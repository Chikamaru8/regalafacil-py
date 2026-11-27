import { getSession } from './_auth.js';

const DEFAULT_CATEGORIES = [
  { slug: 'perfumes-y-fragancias', name: 'Perfumes y Fragancias', sort_order: 10 },
  { slug: 'flores-desayunos-y-regalos', name: 'Flores, Desayunos y Regalos', sort_order: 20 },
  { slug: 'relojes-joyas-y-accesorios', name: 'Relojes, Joyas y Accesorios', sort_order: 30 },
  { slug: 'moda-ropa-y-calzados', name: 'Moda, Ropa y Calzados', sort_order: 40 },
  { slug: 'belleza-y-cuidado-personal', name: 'Belleza y Cuidado Personal', sort_order: 50 },
  { slug: 'tecnologia-y-accesorios', name: 'Tecnología y Accesorios', sort_order: 60 },
  { slug: 'termos-y-bazar', name: 'Termos, Parrilla y Bazar', sort_order: 70 },
  { slug: 'hogar-y-descanso', name: 'Hogar, Deco y Descanso', sort_order: 80 },
  { slug: 'herramientas-y-ferreteria', name: 'Herramientas y Ferretería', sort_order: 90 },
  { slug: 'vehiculos-y-equipamiento', name: 'Vehículos y Equipamiento', sort_order: 100 },
  { slug: 'deportes-camping-y-pesca', name: 'Deportes, Camping y Pesca', sort_order: 110 },
  { slug: 'juguetes-bebes-y-ninos', name: 'Juguetes, Bebés y Niños', sort_order: 120 },
  { slug: 'bebidas-dulces-y-gourmet', name: 'Bebidas, Dulces y Gourmet', sort_order: 130 },
  { slug: 'viajes-y-maletas', name: 'Viajes, Mochilas y Maletas', sort_order: 140 },
  { slug: 'libreria-y-oficina', name: 'Librería, Oficina y Estudio', sort_order: 150 },
  { slug: 'mascotas-y-accesorios', name: 'Mascotas y Accesorios', sort_order: 160 },
  { slug: 'salud-y-bienestar', name: 'Salud y Bienestar', sort_order: 170 },
  { slug: 'otros-y-personalizados', name: 'Otros / Personalizados', sort_order: 180 }
];

const DEFAULT_TAGS = [
  { group_key: 'gender', slug: 'hombre', label: 'Hombre' },
  { group_key: 'gender', slug: 'mujer', label: 'Mujer' },
  { group_key: 'gender', slug: 'unisex', label: 'Unisex' },
  { group_key: 'recipient', slug: 'mama', label: 'Mamá' },
  { group_key: 'recipient', slug: 'papa', label: 'Papá' },
  { group_key: 'recipient', slug: 'pareja', label: 'Pareja' },
  { group_key: 'recipient', slug: 'amigo-a', label: 'Amigo/a' },
  { group_key: 'age', slug: 'nino-a', label: 'Niño/a' },
  { group_key: 'age', slug: 'joven', label: 'Joven' },
  { group_key: 'age', slug: 'adulto', label: 'Adulto' },
  { group_key: 'age', slug: 'adulto-mayor', label: 'Adulto mayor' },
  { group_key: 'occasion', slug: 'cumpleanos', label: 'Cumpleaños' },
  { group_key: 'occasion', slug: 'aniversario', label: 'Aniversario' },
  { group_key: 'occasion', slug: 'dia-de-los-enamorados', label: 'San Valentín' },
  { group_key: 'occasion', slug: 'navidad', label: 'Navidad' }
];

function normText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function ensureSellerPlanColumns(db) {
  const alters = [
    "ALTER TABLE seller ADD COLUMN plan_type TEXT DEFAULT 'trial'",
    'ALTER TABLE seller ADD COLUMN plan_ends_at INTEGER',
    'ALTER TABLE seller ADD COLUMN created_at INTEGER',
    'ALTER TABLE seller ADD COLUMN last_login_at INTEGER'
  ];
  for (const sql of alters) {
    try { await db.prepare(sql).run(); } catch {}
  }
}

async function ensureDefaultCategories(db) {
  try {
    const { results: existing } = await db.prepare('SELECT id, slug, name FROM category').all();
    const rows = existing || [];

    for (const cat of DEFAULT_CATEGORIES) {
      const found = rows.find((r) =>
        normText(r.slug) === normText(cat.slug) ||
        normText(r.name) === normText(cat.name) ||
        (cat.slug === 'termos-y-bazar' && normText(r.name).includes('termos')) ||
        (cat.slug === 'hogar-y-descanso' && normText(r.name).includes('hogar')) ||
        (cat.slug === 'viajes-y-maletas' && normText(r.name).includes('viajes')) ||
        (cat.slug === 'tecnologia-y-accesorios' && normText(r.name).includes('tecnologia'))
      );

      if (found) {
        await db.prepare('UPDATE category SET name = ?, sort_order = ?, active = 1 WHERE id = ?')
          .bind(cat.name, cat.sort_order, found.id).run();
      } else {
        await db.prepare('INSERT INTO category (slug, name, sort_order, active) VALUES (?, ?, ?, 1)')
          .bind(cat.slug, cat.name, cat.sort_order).run();
      }
    }
  } catch (err) {
    console.error('Error sincronizando categorías:', err);
  }
}

async function ensureDefaultTags(db) {
  try {
    const { results: existing } = await db.prepare('SELECT id, slug, label FROM tag').all();
    const rows = existing || [];

    for (const t of DEFAULT_TAGS) {
      const found = rows.find((r) =>
        normText(r.slug) === normText(t.slug) ||
        normText(r.label) === normText(t.label)
      );
      if (!found) {
        await db.prepare('INSERT INTO tag (group_key, slug, label) VALUES (?, ?, ?)')
          .bind(t.group_key, t.slug, t.label).run();
      }
    }
  } catch (err) {
    console.error('Error sincronizando etiquetas:', err);
  }
}

export async function onRequestGet({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  await Promise.all([
    ensureSellerPlanColumns(env.DB),
    ensureDefaultCategories(env.DB),
    ensureDefaultTags(env.DB)
  ]);

  const isSeller = session.role === 'seller' && Boolean(session.sellerId);
  const sellerId = isSeller ? Number(session.sellerId) : null;

  if (isSeller) {
    try {
      await env.DB.prepare('UPDATE seller SET last_login_at = ? WHERE id = ?')
        .bind(Math.floor(Date.now() / 1000), sellerId).run();
    } catch {}
  }

  const sellersQuery = isSeller
    ? env.DB.prepare(
        "SELECT id, slug, name, city, phone, email, approval_status, active, COALESCE(plan_type, 'trial') AS plan_type, plan_ends_at, created_at, last_login_at FROM seller WHERE id = ? LIMIT 1"
      ).bind(sellerId)
    : env.DB.prepare(
        "SELECT id, slug, name, city, phone, email, approval_status, active, COALESCE(plan_type, 'trial') AS plan_type, plan_ends_at, created_at, last_login_at FROM seller ORDER BY CASE WHEN approval_status = 'pending' THEN 0 ELSE 1 END, active DESC, name COLLATE NOCASE, id"
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
    env.DB.prepare('SELECT id, slug, name, sort_order, active FROM category WHERE active = 1 ORDER BY sort_order ASC, id ASC').all(),
    env.DB.prepare('SELECT id, group_key, slug, label FROM tag ORDER BY id ASC').all(),
    sellersQuery.all(),
    productsQuery.all(),
    env.DB.prepare('SELECT id, product_id, color_key FROM product_image ORDER BY product_id, sort_order, id').all(),
    leadsQuery.all()
  ]);

  let onboardingLogs = [];
  if (!isSeller) {
    try {
      const { results: logs } = await env.DB.prepare(`
        SELECT id, seller_id, name, city, phone, email, slug, method, welcome_sent, admin_notified, created_at
        FROM onboarding_log
        ORDER BY id DESC
        LIMIT 50
      `).all();
      onboardingLogs = logs || [];
    } catch {
      onboardingLogs = [];
    }
  }

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

  const me = isSeller ? sellers[0] : null;
  const sessionOut = isSeller
    ? {
        ...session,
        slug: me?.slug || '',
        plan_type: me?.plan_type || 'trial',
        plan_ends_at: me?.plan_ends_at || null,
        created_at: me?.created_at || null
      }
    : session;

  return Response.json({
    session: sessionOut,
    settings,
    categories,
    tags,
    sellers,
    onboardingLogs,
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