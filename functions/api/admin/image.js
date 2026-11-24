const ALLOWED_MIME = ['image/webp', 'image/jpeg', 'image/png'];
const MAX_BYTES = 900 * 1024;
const MAX_IMAGES_PER_PRODUCT = 8; // Limite maximo de fotos por producto

// Sube una foto nueva. SIEMPRE agrega al final; el orden se cambia con PUT.
export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: 'Formulario inválido' }, { status: 400 }); }

  const productId = Number(form.get('product_id'));
  const colorKey = String(form.get('color_key') || '').trim() || null;
  const file = form.get('file');

  if (!productId || !file || typeof file === 'string') {
    return Response.json({ error: 'Producto e imagen requeridos' }, { status: 400 });
  }

  const mime = String(file.type || '').toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    return Response.json({ error: 'Formato no permitido (usá WebP, JPG o PNG)' }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return Response.json({ error: 'La imagen supera los 900 KB' }, { status: 400 });
  }

  const exists = await env.DB.prepare('SELECT id FROM product WHERE id = ?').bind(productId).first();
  if (!exists) return Response.json({ error: 'Producto no encontrado' }, { status: 404 });

  const countRes = await env.DB.prepare('SELECT COUNT(*) as cnt FROM product_image WHERE product_id = ?').bind(productId).first();
  if ((countRes?.cnt || 0) >= MAX_IMAGES_PER_PRODUCT) {
    return Response.json({ error: `El producto ya alcanzó el límite de ${MAX_IMAGES_PER_PRODUCT} fotos` }, { status: 400 });
  }

  const maxOrderRes = await env.DB.prepare('SELECT MAX(sort_order) as max_ord FROM product_image WHERE product_id = ?').bind(productId).first();
  const nextOrder = (maxOrderRes?.max_ord ?? -1) + 1;

  const ins = await env.DB.prepare(
    'INSERT INTO product_image (product_id, mime, bytes, data, sort_order, color_key) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(productId, mime, buf.byteLength, buf, nextOrder, colorKey).run();

  return Response.json({ ok: true, id: ins.meta?.last_row_id });
}

// Guarda el orden de las fotos de un producto. La primera de la lista es la principal.
// Body: { product_id, order: [id, id, ...] }
export async function onRequestPut({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const productId = Number(b?.product_id);
  const requested = Array.isArray(b?.order) ? b.order.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  if (!productId || !requested.length) {
    return Response.json({ error: 'Producto y orden requeridos' }, { status: 400 });
  }

  const rows = await env.DB.prepare(
    'SELECT id FROM product_image WHERE product_id = ? ORDER BY sort_order, id'
  ).bind(productId).all();
  const existing = (rows.results || []).map((r) => r.id);
  const valid = new Set(existing);

  // Solo ids que pertenecen al producto, sin repetir; las fotos que no vengan en la lista quedan al final
  const first = [...new Set(requested)].filter((id) => valid.has(id));
  const final = [...first, ...existing.filter((id) => !first.includes(id))];

  await env.DB.batch(
    final.map((id, i) =>
      env.DB.prepare('UPDATE product_image SET sort_order = ? WHERE id = ? AND product_id = ?').bind(i, id, productId)
    )
  );

  return Response.json({ ok: true, order: final });
}

export async function onRequestDelete({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });
  await env.DB.prepare('DELETE FROM product_image WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}