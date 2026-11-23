const ALLOWED_MIME = ['image/webp', 'image/jpeg', 'image/png'];
const MAX_BYTES = 900 * 1024;

// Reemplaza la foto del producto (la interfaz maneja una foto por producto).
export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: 'Formulario inválido' }, { status: 400 }); }

  const productId = Number(form.get('product_id'));
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

  const [, ins] = await env.DB.batch([
    env.DB.prepare('DELETE FROM product_image WHERE product_id = ?').bind(productId),
    env.DB.prepare('INSERT INTO product_image (product_id, mime, bytes, data, sort_order) VALUES (?, ?, ?, ?, 0)')
      .bind(productId, mime, buf.byteLength, buf)
  ]);

  return Response.json({ ok: true, id: ins.meta?.last_row_id });
}

export async function onRequestDelete({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 400 });
  await env.DB.prepare('DELETE FROM product_image WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}
