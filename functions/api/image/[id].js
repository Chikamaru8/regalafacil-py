export async function onRequestGet({ params, env }) {
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
