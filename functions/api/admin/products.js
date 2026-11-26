import { getSession } from './_auth.js';

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'prod-' + Date.now();
}

const MAX_OFFER_SECONDS = 400 * 86400;

function clean(b, session = null) {
  if (!b || typeof b !== 'object') return { error: 'Datos inválidos' };
  const name = String(b.name || '').trim().slice(0, 120);
  const price = Math.round(Number(b.price_gs));
  if (!name || !Number.isFinite(price) || price <= 0) {
    return { error: 'Nombre y precio válido son obligatorios' };
  }

  const now = Math.floor(Date.now() / 1000);
  const offerPrice = Math.round(Number(b.offer_price_gs)) || 0;
  let offerEnds = null;
  if (offerPrice > 0) {
    if (offerPrice >= price) return { error: 'El precio de oferta debe ser menor al precio normal' };
    offerEnds = Math.floor(Number(b.offer_ends_at));
    if (!offerEnds) return { error: 'Indicá hasta cuándo vale la oferta' };
    if (offerEnds <= now) return { error: 'La fecha de fin de la oferta debe ser futura' };
    if (offerEnds > now + MAX_OFFER_SECONDS) return { error: 'La oferta no puede durar más de un año' };
  }

  const rawCatId = Number(b.category_id);
  const catId = Number.isInteger(rawCatId) && rawCatId > 0 ? rawCatId : null;

  const tagIds = Array.isArray(b.tag_ids)
    ? [...new Set(b.tag_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  let colorsParsed = [];
  try {
    if (typeof b.colors === 'string') {
      colorsParsed = JSON.parse(b.colors);
    } else if (Array.isArray(b.colors)) {
      colorsParsed = b.colors;
    }
  } catch {
    colorsParsed = [];
  }

  const validColors = colorsParsed.filter(c => c && typeof c.name === 'string' && c.name.trim() !== '');
  const baseAttrs = b.attributes && typeof b.attributes === 'object' ? { ...b.attributes } : {};
  const city = String(b.city ?? baseAttrs.city ?? '').trim().slice(0, 80);

  let resolvedSellerId = null;
  if (session?.role === 'seller' && session.sellerId) {
    resolvedSellerId = Number(session.sellerId);
  } else {
    const rawSellerId = b.seller_id !== undefined ? b.seller_id : baseAttrs.seller_id;
    const nSeller = Number(rawSellerId);
    resolvedSellerId = Number.isInteger(nSeller) && nSeller > 0 ? nSeller : null;
  }

  const nextAttrs = {
    ...baseAttrs,
    colors: validColors.length > 0 ? validColors : []
  };

  if (b.short_detail !== undefined) {
    const sd = String(b.short_detail || '').trim().slice(0, 90);
    if (sd) {
      nextAttrs.short_detail = sd;
    } else {
      delete nextAttrs.short_detail;
    }
  }

  if (city) {
    nextAttrs.city = city;
  } else {
    delete nextAttrs.city;
  }

  if (resolvedSellerId) {
    nextAttrs.seller_id = resolvedSellerId;
  } else {
    delete nextAttrs.seller_id;
  }

  return {
    value: {
      name,
      price,
      desc: String(b.description || '').trim().slice(0, 1000),
      catId,
      status: b.status === 'paused' ? 'paused' : 'active',
      sellerId: resolvedSellerId,
      attrs: JSON.stringify(nextAttrs),
      tagIds,
      offerPrice,
      offerEnds,
      now
    }
  };
}

async function hasProductSellerColumn(env) {
  try {
    const info = await env.DB.prepare("PRAGMA table_info('product')").all();
    return (info?.results || []).some(col => col.name === 'seller_id');
  } catch {
    return false;
  }
}

async function isProductOwnedBySeller(env, productId, sellerId, hasCol) {
  const row = await env.DB.prepare('SELECT id, attributes' + (hasCol ? ', seller_id' : '') + ' FROM product WHERE id = ? LIMIT 1')
    .bind(productId).first();
  if (!row) return { exists: false, owned: false };

  let attrSellerId = null;
  try {
    const parsed = row.attributes ? JSON.parse(row.attributes) : {};
    if (parsed?.seller_id) attrSellerId = Number(parsed.seller_id);
  } catch {}

  const colSellerId = hasCol && row.seller_id ? Number(row.seller_id) : null;
  const ownerId = colSellerId || attrSellerId;
  return { exists: true, owned: ownerId === Number(sellerId) };
}

async function syncTagsAndOffer(env, productId, v) {
  const stmts = [env.DB.prepare('DELETE FROM product_tag WHERE product_id = ?').bind(productId)];
  for (const tid of v.tagIds) {
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO product_tag (product_id, tag_id) VALUES (?, ?)').bind(productId, tid));
  }
  stmts.push(env.DB.prepare('DELETE FROM offer WHERE product_id = ?').bind(productId));
  if (v.offerPrice > 0) {
    stmts.push(
      env.DB.prepare('INSERT INTO offer (product_id, offer_price_gs, starts_at, ends_at) VALUES (?, ?, ?, ?)')
        .bind(productId, v.offerPrice, v.now - 60, v.offerEnds)
    );
  }
  await env.DB.batch(stmts);
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export async function onRequestPost({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const { error, value: v } = clean(await readJson(request), session);
  if (error) return Response.json({ error }, { status: 400 });

  const slug = slugify(v.name) + '-' + Math.random().toString(36).slice(2, 6);
  const hasCol = await hasProductSellerColumn(env);

  const res = hasCol
    ? await env.DB.prepare(
        'INSERT INTO product (slug, name, description, price_gs, category_id, status, seller_id, attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(slug, v.name, v.desc, v.price, v.catId, v.status, v.sellerId, v.attrs).run()
    : await env.DB.prepare(
        'INSERT INTO product (slug, name, description, price_gs, category_id, status, attributes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(slug, v.name, v.desc, v.price, v.catId, v.status, v.attrs).run();

  const productId = res.meta?.last_row_id;
  if (!productId) return Response.json({ error: 'No se pudo crear el producto' }, { status: 500 });

  await syncTagsAndOffer(env, productId, v);
  return Response.json({ ok: true, id: productId });
}

export async function onRequestPut({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const body = await readJson(request);
  const id = Number(body?.id);
  const { error, value: v } = clean(body, session);
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });
  if (error) return Response.json({ error }, { status: 400 });

  const hasCol = await hasProductSellerColumn(env);
  if (session.role === 'seller') {
    const check = await isProductOwnedBySeller(env, id, session.sellerId, hasCol);
    if (!check.exists) return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
    if (!check.owned) return Response.json({ error: 'Solo podés editar tus propios productos' }, { status: 403 });
  }

  const res = hasCol
    ? await env.DB.prepare(
        "UPDATE product SET name = ?, description = ?, price_gs = ?, category_id = ?, status = ?, seller_id = ?, attributes = ?, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE id = ?"
      ).bind(v.name, v.desc, v.price, v.catId, v.status, v.sellerId, v.attrs, id).run()
    : await env.DB.prepare(
        "UPDATE product SET name = ?, description = ?, price_gs = ?, category_id = ?, status = ?, attributes = ?, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE id = ?"
      ).bind(v.name, v.desc, v.price, v.catId, v.status, v.attrs, id).run();

  if (!res.meta?.changes) return Response.json({ error: 'Producto no encontrado' }, { status: 404 });

  await syncTagsAndOffer(env, id, v);

  if (Array.isArray(body?.image_ids)) {
    const validIds = [...new Set(body.image_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const imgStmts = [];

    if (validIds.length > 0) {
      imgStmts.push(
        env.DB.prepare(
          `DELETE FROM product_image WHERE product_id = ? AND id NOT IN (${validIds.map(() => '?').join(',')})`
        ).bind(id, ...validIds)
      );
      validIds.forEach((imgId, idx) => {
        imgStmts.push(
          env.DB.prepare('UPDATE product_image SET sort_order = ? WHERE id = ? AND product_id = ?')
            .bind(idx, imgId, id)
        );
      });
    } else {
      imgStmts.push(env.DB.prepare('DELETE FROM product_image WHERE product_id = ?').bind(id));
    }

    await env.DB.batch(imgStmts);
  }

  return Response.json({ ok: true, id });
}

export async function onRequestDelete({ request, env, data }) {
  const session = data?.session || (await getSession(request, env));
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });

  const hasCol = await hasProductSellerColumn(env);
  if (session.role === 'seller') {
    const check = await isProductOwnedBySeller(env, id, session.sellerId, hasCol);
    if (!check.exists) return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
    if (!check.owned) return Response.json({ error: 'Solo podés eliminar tus propios productos' }, { status: 403 });
  }

  const [, , , delProd] = await env.DB.batch([
    env.DB.prepare('DELETE FROM product_image WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM product_tag WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM offer WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM product WHERE id = ?').bind(id)
  ]);

  if (!delProd?.meta?.changes) return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
  return Response.json({ ok: true, id });
}