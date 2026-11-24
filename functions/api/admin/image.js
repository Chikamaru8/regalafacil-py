const ALLOWED_MIME = ['image/webp', 'image/jpeg', 'image/png'];
const MAX_BYTES = 900 * 1024;
const MAX_IMAGES_PER_PRODUCT = 8; // Límite máximo de fotos por producto

export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: 'Formulario inválido' }, { status: 400 }); }

  const productId = Number(form.get('product_id'));
  const colorKey = String(form.get('color_key') || '').trim() || null; // Capturar color_key opcional
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

  // Verificar cuántas imágenes tiene el producto actualmente para no superar el límite
  const countRes = await env.DB.prepare('SELECT COUNT(*) as cnt FROM product_image WHERE product_id = ?').bind(productId).first();
  if ((countRes?.cnt || 0) >= MAX_IMAGES_PER_PRODUCT) {
    return Response.json({ error: `El producto ya alcanzó el límite de ${MAX_IMAGES_PER_PRODUCT} imágenes` }, { status: 400 });
  }

  // Obtener el siguiente sort_order
  const maxOrderRes = await env.DB.prepare('SELECT MAX(sort_order) as max_ord FROM product_image WHERE product_id = ?').bind(productId).first();
  const nextOrder = (maxOrderRes?.max_ord ?? -1) + 1;

  // Insertar la nueva imagen sin borrar las anteriores, asociando el color_key si viene presente
  const ins = await env.DB.prepare(
    'INSERT INTO product_image (product_id, mime, bytes, data, sort_order, color_key) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(productId, mime, buf.byteLength, buf, nextOrder, colorKey).run();

  return Response.json({ ok: true, id: ins.meta?.last_row_id });
}

export async function onRequestDelete({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });
  await env.DB.prepare('DELETE FROM product_image WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}