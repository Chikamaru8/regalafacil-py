function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtGs(n) {
  return 'Gs. ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Solo interceptamos la página principal cuando trae ?p=<id_producto>
  const isHome = url.pathname === '/' || url.pathname === '/index.html';
  const prodIdParam = url.searchParams.get('p');

  if (!isHome || !prodIdParam || !/^\d+$/.test(prodIdParam)) {
    return next();
  }

  const response = await next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  try {
    const prodId = Number(prodIdParam);
    const imgParam = url.searchParams.get('img');
    const nowSec = Math.floor(Date.now() / 1000);

    const product = await env.DB.prepare(`
      SELECT p.id, p.name, p.description, p.price_gs,
        (SELECT o.offer_price_gs FROM offer o WHERE o.product_id = p.id AND o.ends_at > ? ORDER BY o.id DESC LIMIT 1) AS offer_price_gs,
        (SELECT pi.id FROM product_image pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1) AS first_img_id
      FROM product p
      WHERE p.id = ?
      LIMIT 1
    `).bind(nowSec, prodId).first();

    if (!product) return response;

    // Si viene &img=ID, validamos que exista y pertenezca a ese producto; si no, usamos la foto principal
    let chosenImgId = product.first_img_id || null;
    if (imgParam && /^\d+$/.test(imgParam)) {
      const exactImg = await env.DB.prepare(
        'SELECT id FROM product_image WHERE id = ? AND product_id = ? LIMIT 1'
      ).bind(Number(imgParam), prodId).first();
      if (exactImg?.id) chosenImgId = exactImg.id;
    }

    const activePrice = Number(product.offer_price_gs) > 0 ? product.offer_price_gs : product.price_gs;
    const ogTitle = `${product.name} · ${fmtGs(activePrice)} — RegaláFácil PY`;
    const ogDesc = (product.description || 'Consultá disponibilidad directo por WhatsApp en RegaláFácil PY.').slice(0, 160);
    const ogImage = chosenImgId
      ? `${url.origin}/api/image/${chosenImgId}`
      : `${url.origin}/regalito.png`;

    const metaTags = `
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="RegaláFácil PY">
  <meta property="og:title" content="${escapeAttr(ogTitle)}">
  <meta property="og:description" content="${escapeAttr(ogDesc)}">
  <meta property="og:image" content="${escapeAttr(ogImage)}">
  <meta property="og:url" content="${escapeAttr(url.href)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(ogTitle)}">
  <meta name="twitter:description" content="${escapeAttr(ogDesc)}">
  <meta name="twitter:image" content="${escapeAttr(ogImage)}">
`;

    let html = await response.text();
    html = html.replace('</head>', `${metaTags}</head>`);

    const newHeaders = new Headers(response.headers);
    newHeaders.delete('content-length');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (err) {
    console.error('Error en middleware OG:', err);
    return response;
  }
}