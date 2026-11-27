const state = { data: null, selectedFile: null, editingProduct: null };

const getCacheStamp = () => Date.now();

const $ = (sel) => document.querySelector(sel);
const dots = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtGs = (n) => dots(n) + ' Gs.';
const digitsToInt = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0;
const imgUrl = (id) => `/api/image/${id}?t=${getCacheStamp()}`;
const nowSec = () => Math.floor(Date.now() / 1000);
const fmtDate = (ts) =>
  new Date(ts * 1000).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const toLocalInput = (ts) => {
  const d = new Date(ts * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const offerActive = (p) => Number(p.offer_price_gs) > 0 && Number(p.offer_ends_at) > nowSec();
const offerExpired = (p) => Number(p.offer_price_gs) > 0 && Number(p.offer_ends_at) <= nowSec();

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function waLink(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '595' + d.slice(1);
  return `https://wa.me/${d}`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...opts
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text }; }
  if (!res.ok) {
    if (res.status === 401 && state.data) {
      state.data = null;
      showLogin('Tu sesión venció. Ingresá de nuevo.');
    }
    const err = new Error(json.error || `Error HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function setAuthMode(mode) {
  $('#loginForm').hidden = mode !== 'login';
  $('#registerForm').hidden = mode !== 'register';
  $('#forgotForm').hidden = mode !== 'forgot';
  $('#loginError').hidden = true;
  $('#registerError').hidden = true;
  $('#registerMsg').hidden = true;
  $('#forgotError').hidden = true;
  $('#forgotMsg').hidden = true;
}

$('#openForgotBtn')?.addEventListener('click', () => setAuthMode('forgot'));
$('#openRegisterBtn')?.addEventListener('click', () => setAuthMode('register'));
document.querySelectorAll('[data-back-login]').forEach((btn) => {
  btn.addEventListener('click', () => setAuthMode('login'));
});

document.querySelectorAll('.pass-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePass);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? '🙈' : '👁️';
    btn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

function showLogin(msg = '') {
  state.data = null;
  $('#adminApp').hidden = true;
  $('#loginView').hidden = false;
  const startInRegister = new URLSearchParams(window.location.search).get('modo') === 'registro';
  setAuthMode(startInRegister ? 'register' : 'login');
  $('#loginError').textContent = msg;
  $('#loginError').hidden = !msg;
}

function isSellerSession() {
  return state.data?.session?.role === 'seller';
}

function getMySellerRecord() {
  if (!isSellerSession()) return null;
  const myId = Number(state.data?.session?.sellerId);
  return (state.data?.sellers || []).find((s) => Number(s.id) === myId) || state.data?.sellers?.[0] || null;
}

function getSellerBannersGrid() {
  let grid = $('#sellerTopBanners');
  if (!isSellerSession()) {
    if (grid) grid.remove();
    return null;
  }
  if (!grid) {
    grid = document.createElement('div');
    grid.id = 'sellerTopBanners';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:16px;align-items:stretch;';
    const productsTab = $('#tab-products');
    if (productsTab) productsTab.prepend(grid);
  }
  return grid;
}

function downloadSellerPromoImage(sellerName, shareUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#4c0519');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(70, 70, 940, 940, 48);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.roundRect(320, 150, 440, 68, 34);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎁 REGALÁFÁCIL PY', 540, 195);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px sans-serif';
  const cleanName = String(sellerName || 'Mi Tienda').slice(0, 26);
  ctx.fillText(cleanName, 540, 360);

  ctx.fillStyle = '#fda4af';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('¡Mis productos ya están online!', 540, 460);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '34px sans-serif';
  ctx.fillText('Mirá el catálogo completo y hacé', 540, 560);
  ctx.fillText('tu pedido directo por WhatsApp', 540, 610);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(120, 730, 840, 120, 28);
  ctx.fill();

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('INGRESÁ AQUÍ:', 540, 775);

  ctx.fillStyle = '#e11d48';
  ctx.font = 'bold 28px sans-serif';
  const displayUrl = shareUrl.replace(/^https?:\/\//, '');
  ctx.fillText(displayUrl.slice(0, 44), 540, 822);

  const a = document.createElement('a');
  a.download = `estado-regalafacil-${(sellerName || 'tienda').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function renderSellerShareBanner() {
  const grid = getSellerBannersGrid();
  if (!grid) return;

  const slug = state.data?.session?.slug || '';
  const sellerName = state.data?.session?.name || 'Mi tienda';
  const shareUrl = slug
    ? `${window.location.origin}/?v=${encodeURIComponent(slug)}`
    : `${window.location.origin}/`;

  const promoText = `🎁 ¡Mis productos de *${sellerName}* ahora están en *RegaláFácil PY*!\nMirá mi catálogo y hacé tu pedido directo por WhatsApp aquí 👇\n${shareUrl}`;

  let box = $('#sellerShareBanner');
  if (!box) {
    box = document.createElement('div');
    box.id = 'sellerShareBanner';
    box.className = 'settings-card';
    box.style.marginBottom = '0';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.justifyContent = 'space-between';
    box.style.gap = '10px';
    grid.appendChild(box);
  }

  box.innerHTML = `
    <div>
      <strong style="font-size:13px;color:#0f172a;">🔗 Tu enlace directo de ventas</strong>
      <div class="muted" style="font-size:12px;margin-top:2px;">Copiá y pegalo en tu estado de WhatsApp o perfil de Instagram.</div>
      <div class="muted" style="font-size:11.5px;word-break:break-all;margin-top:4px;color:#e11d48;font-weight:600;">${escapeHtml(shareUrl)}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" id="copySellerLinkBtn" class="btn btn-ghost btn-sm" style="background:#fff;border:1px solid #cbd5e1;">📋 Copiar para estado</button>
      <button type="button" id="downloadPromoImgBtn" class="btn btn-ghost btn-sm" style="background:#fff;border:1px solid #cbd5e1;">🖼️ Imagen para estado</button>
    </div>
  `;

  $('#copySellerLinkBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(promoText);
      $('#copySellerLinkBtn').textContent = '✅ ¡Texto y link copiados!';
      setTimeout(() => { $('#copySellerLinkBtn').textContent = '📋 Copiar para estado'; }, 2200);
    } catch {
      prompt('Copiá este texto para tu estado:', promoText);
    }
  });

  $('#downloadPromoImgBtn')?.addEventListener('click', () => {
    downloadSellerPromoImage(sellerName, shareUrl);
    $('#downloadPromoImgBtn').textContent = '✅ ¡Imagen descargada!';
    setTimeout(() => { $('#downloadPromoImgBtn').textContent = '🖼️ Imagen para estado'; }, 2200);
  });
}

function renderSellerPlanBanner() {
  const grid = getSellerBannersGrid();
  if (!grid) return;

  const sess = state.data?.session || {};
  const planType = String(sess.plan_type || 'trial').toLowerCase();
  const endsAt = Number(sess.plan_ends_at || 0);
  const DAY_SEC = 86400;
  const now = nowSec();

  let box = $('#sellerPlanBanner');
  if (!box) {
    box = document.createElement('div');
    box.id = 'sellerPlanBanner';
    box.className = 'settings-card';
    box.style.marginBottom = '0';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.justifyContent = 'space-between';
    box.style.gap = '10px';
    grid.prepend(box);
  }

  if (planType === 'vip') {
    box.style.background = '#f0fdf4';
    box.style.borderColor = '#bbf7d0';
    box.innerHTML = `
      <div>
        <strong style="font-size:13px;color:#15803d;">⭐ Plan VIP sin costo activo</strong>
        <div class="muted" style="font-size:12px;margin-top:4px;">Tenés acceso libre e ilimitado por ser parte de los primeros aliados de RegaláFácil PY.</div>
      </div>
    `;
    return;
  }

  const diffDays = endsAt ? Math.ceil((endsAt - now) / DAY_SEC) : 60;
  const fechaVenc = endsAt
    ? new Date(endsAt * 1000).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  let title = '';
  let subtitle = '';
  let bg = '#fff';
  let border = '#e2e8f0';

  if (diffDays > 0) {
    const label = planType === 'paid' ? 'Suscripción activa' : 'Prueba gratis activa';
    title = `⏳ ${label}: te quedan ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    subtitle = fechaVenc
      ? `Vence el ${fechaVenc}. Renovación mensual: Gs. 30.000.`
      : 'Renovación mensual: Gs. 30.000.';
    if (diffDays <= 7) {
      bg = '#fffbeb';
      border = '#fde68a';
    }
  } else if (diffDays >= -2) {
    const graceLeft = 2 + diffDays;
    bg = '#fff7ed';
    border = '#fdba74';
    title = `⚠️ Tu plan venció · Tenés ${graceLeft} ${graceLeft === 1 ? 'día' : 'días'} de gracia`;
    subtitle = 'Realizá tu pago de Gs. 30.000 y subí el comprobante para sumar +30 días al instante.';
  } else {
    bg = '#fef2f2';
    border = '#fecaca';
    title = '⛔ Tu suscripción está vencida';
    subtitle = 'Aboná Gs. 30.000 por Alias y subí tu comprobante para reactivar tu tienda al instante.';
  }

  box.style.background = bg;
  box.style.borderColor = border;
  box.innerHTML = `
    <div>
      <strong style="font-size:13px;color:#0f172a;">${escapeHtml(title)}</strong>
      <div class="muted" style="font-size:12px;margin-top:4px;">${escapeHtml(subtitle)}</div>
    </div>
    <div>
      <button type="button" id="openPaymentModalBtn" class="btn btn-primary btn-sm">💳 Realizar pago</button>
    </div>
  `;

  $('#openPaymentModalBtn')?.addEventListener('click', () => {
    $('#payMsg').hidden = true;
    $('#payError').hidden = true;
    $('#payReceiptFile').value = '';
    $('#payReceiptFile').disabled = true;
    $('#submitPaymentBtn').disabled = true;
    $('#payUploadBox').style.opacity = '.6';
    $('#payUploadHint').innerHTML = 'Tocá <strong>Copiar alias</strong> arriba para habilitar la carga del comprobante.';
    $('#copyAliasBtn').textContent = '📋 Copiar alias';
    $('#paymentModal')?.showModal();
  });
}

$('#closePaymentBtn')?.addEventListener('click', () => $('#paymentModal')?.close());

$('#copyAliasBtn')?.addEventListener('click', async () => {
  const alias = '4056694';
  try {
    await navigator.clipboard.writeText(alias);
  } catch {}
  $('#copyAliasBtn').textContent = '✅ Alias copiado';
  $('#payReceiptFile').disabled = false;
  $('#submitPaymentBtn').disabled = false;
  $('#payUploadBox').style.opacity = '1';
  $('#payUploadHint').textContent = '¡Listo! Una vez hecha la transferencia, seleccioná la captura aquí abajo.';
});

$('#paymentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#payMsg').hidden = true;
  $('#payError').hidden = true;

  const file = $('#payReceiptFile')?.files?.[0];
  if (!file) {
    $('#payError').textContent = 'Seleccioná la captura de tu comprobante.';
    $('#payError').hidden = false;
    return;
  }

  $('#submitPaymentBtn').disabled = true;
  $('#submitPaymentBtn').textContent = 'Enviando comprobante...';

  try {
    const compressed = await compressImageFile(file);
    const fd = new FormData();
    fd.append('receipt', compressed, 'comprobante.webp');
    const res = await api('/api/seller/payment', { method: 'POST', body: fd });
    $('#payMsg').textContent = res.message || '¡Pago registrado! Sumamos +30 días a tu cuenta.';
    $('#payMsg').hidden = false;
    await refreshBootstrap();
    setTimeout(() => $('#paymentModal')?.close(), 1800);
  } catch (err) {
    $('#payError').textContent = err.message;
    $('#payError').hidden = false;
  } finally {
    $('#submitPaymentBtn').disabled = false;
    $('#submitPaymentBtn').textContent = 'Subir comprobante y activar +30 días';
  }
});

function applyRoleUi() {
  const isSeller = isSellerSession();
  const badge = $('#roleBadge');
  if (badge) {
    badge.textContent = isSeller ? `Vendedor: ${state.data?.session?.name || ''}` : 'Admin';
  }

  const sellerNav = document.querySelector('.nav-item[data-tab="sellers"]');
  const sellerTab = $('#tab-sellers');
  if (sellerNav) sellerNav.hidden = isSeller;
  if (sellerTab && isSeller) {
    sellerTab.classList.remove('active');
    if (sellerNav.classList.contains('active')) {
      sellerNav.classList.remove('active');
      document.querySelector('.nav-item[data-tab="products"]')?.classList.add('active');
      $('#tab-products')?.classList.add('active');
    }
  }

  const sellerFilter = $('#leadSellerFilter');
  if (sellerFilter) sellerFilter.hidden = isSeller;

  const ownerRow = $('#prodOwnerRow');
  if (ownerRow) ownerRow.hidden = isSeller;

  const prodSellerSelect = $('#prodSeller');
  if (prodSellerSelect) prodSellerSelect.disabled = isSeller;

  const ownerHelp = $('#prodOwnerHelp');
  if (ownerHelp) {
    ownerHelp.textContent = isSeller
      ? 'Tus productos se publican automáticamente con tu tienda y tu WhatsApp.'
      : 'Los pedidos de este producto irán directo al WhatsApp del vendedor elegido (si queda vacío, van al administrador).';
  }

  renderSellerShareBanner();
  renderSellerPlanBanner();
}

async function showApp() {
  await refreshBootstrap();
  applyRoleUi();
  $('#loginView').hidden = true;
  $('#adminApp').hidden = false;
}

async function refreshBootstrap() {
  state.data = await api('/api/admin/bootstrap');
  applyRoleUi();
  setupAdminSearchAndSort(state.data?.products || []);
  populateFormOptions();
  setupLeadsControls();
  renderLeads();
  renderPendingApprovals();
  setupPriceFormatter();
}

/* ---------- Aprobador de vendedores pendientes (Admin) ---------- */
function isPendingSeller(s) {
  if (!s) return false;
  if (s.approval_status === 'pending') return true;
  if (s.approval_status === 'approved' || s.approval_status === 'rejected') return false;
  return Number(s.active) === 0 && Boolean(s.email);
}

function renderPendingApprovals() {
  const card = $('#pendingApprovalsCard');
  const list = $('#pendingApprovalsList');
  if (!card || !list) return;

  if (isSellerSession()) {
    card.hidden = true;
    return;
  }

  const pending = (state.data?.sellers || []).filter(isPendingSeller);
  if (!pending.length) {
    card.hidden = true;
    list.innerHTML = '';
    return;
  }

  card.hidden = false;
  list.innerHTML = pending.map((s) => `
    <div class="pending-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div>
          <strong>${escapeHtml(s.name)}</strong>
          ${s.email ? `<span class="muted"> · ${escapeHtml(s.email)}</span>` : ''}
          ${s.phone ? `<div class="muted" style="font-size:12px;">📱 ${escapeHtml(s.phone)}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-primary btn-sm" data-approve-seller="${s.id}">Aprobar</button>
          <button type="button" class="btn btn-danger btn-sm" data-reject-seller="${s.id}">Rechazar</button>
        </div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-approve-seller]').forEach((btn) => {
    btn.addEventListener('click', () => handleSellerApproval(Number(btn.dataset.approveSeller), 'approved', 1));
  });

  list.querySelectorAll('[data-reject-seller]').forEach((btn) => {
    btn.addEventListener('click', () => handleSellerApproval(Number(btn.dataset.rejectSeller), 'rejected', 0));
  });
}

async function handleSellerApproval(sellerId, approvalStatus, active) {
  const seller = (state.data?.sellers || []).find((s) => Number(s.id) === Number(sellerId));
  if (!seller) return;
  try {
    await api('/api/admin/sellers', {
      method: 'PUT',
      body: JSON.stringify({
        id: seller.id,
        name: seller.name,
        city: seller.city || '',
        phone: seller.phone,
        email: seller.email || '',
        approval_status: approvalStatus,
        active
      })
    });
    await refreshBootstrap();
  } catch (err) {
    alert(err.message);
  }
}

/* ---------- Productos, buscador y orden ---------- */
let adminProducts = [];
let adminTerm = '';
let adminSort = { key: null, asc: true };

function visibleProducts() {
  let list = [...adminProducts];
  if (isSellerSession()) {
    const myId = Number(state.data?.session?.sellerId);
    list = list.filter((p) => {
      const pSeller = Number(p.seller_id || p.attributes?.seller_id || 0);
      return pSeller === myId;
    });
  }
  if (adminTerm) list = list.filter((p) => String(p.name || '').toLowerCase().includes(adminTerm));
  if (adminSort.key === 'name') {
    list.sort((a, b) => (adminSort.asc ? 1 : -1) * String(a.name).localeCompare(String(b.name), 'es'));
  } else if (adminSort.key === 'price') {
    list.sort((a, b) => (adminSort.asc ? 1 : -1) * (Number(a.price_gs) - Number(b.price_gs)));
  }
  return list;
}

function renderProducts(products = []) {
  const list = $('#productsList');
  if (!products.length) {
    if (!adminTerm) {
      list.innerHTML = `
        <div class="empty-onboarding">
          <div class="empty-onboarding-icon">🎁</div>
          <h3>¡Subí tu primer producto en segundos!</h3>
          <p>Subí una o varias fotos, elegí la categoría, público y precio. Tus clientes te van a escribir directo a tu WhatsApp.</p>
          <button type="button" id="emptyAddProductBtn" class="btn btn-primary" style="margin-top:4px;">📸 Subir mi primer producto</button>
        </div>
      `;
      $('#emptyAddProductBtn')?.addEventListener('click', () => openProductModal(null));
    } else {
      list.innerHTML = '<p class="muted">No se encontraron productos con esa búsqueda.</p>';
    }
    return;
  }

  const sellers = state.data?.sellers || [];

  list.innerHTML = products.map((p) => {
    const firstImgId = p.image_ids?.[0];
    const imgSrc = firstImgId ? imgUrl(firstImgId) : '';
    const active = offerActive(p);
    const isActive = p.status === 'active';
    const cityLabel = p.attributes?.city ? String(p.attributes.city).trim() : '';
    const shortDetail = p.attributes?.short_detail ? String(p.attributes.short_detail).trim() : '';
    const sellerId = p.seller_id || p.attributes?.seller_id ? Number(p.seller_id || p.attributes.seller_id) : null;
    const sellerObj = sellerId ? sellers.find((s) => Number(s.id) === sellerId) : null;
    return `
      <article class="card">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${escapeHtml(p.name)}" class="card-thumb" loading="lazy" />`
          : `<div class="card-thumb"></div>`}
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            <span class="pill ${isActive ? 'pill-ok' : 'pill-warn'}">${isActive ? 'Disponible' : 'Agotado'}</span>
            ${sellerObj ? `<span class="pill">👤 ${escapeHtml(sellerObj.name)}</span>` : ''}
            ${cityLabel ? `<span class="pill">${escapeHtml(cityLabel)}</span>` : ''}
            ${offerExpired(p) ? '<span class="pill pill-warn">Oferta vencida</span>' : ''}
          </div>
          <div class="price-row">
            ${active
              ? `<span class="price-offer">${fmtGs(p.offer_price_gs)}</span>
                 <span class="price-strike">${fmtGs(p.price_gs)}</span>`
              : `<span class="price-main">${fmtGs(p.price_gs)}</span>`}
          </div>
          ${shortDetail ? `<p class="muted" style="margin:2px 0 0;font-weight:600;">✦ ${escapeHtml(shortDetail)}</p>` : ''}
          ${active ? `<p class="muted" style="margin:2px 0 0;">Oferta hasta ${fmtDate(p.offer_ends_at)}</p>` : ''}
          ${p.description ? `<p class="muted" style="margin:4px 0 0;">${escapeHtml(p.description)}</p>` : ''}
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit-id="${p.id}">Editar</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = state.data.products.find((x) => x.id === Number(btn.dataset.editId));
      if (prod) openProductModal(prod);
    });
  });
}

function setupAdminSearchAndSort(products) {
  adminProducts = products || [];

  const searchInput = $('#searchInput');
  const sortByNameBtn = $('#sortByName');
  const sortByPriceBtn = $('#sortByPrice');

  if (searchInput && !searchInput.dataset.initialized) {
    searchInput.dataset.initialized = 'true';
    searchInput.addEventListener('input', (e) => {
      adminTerm = e.target.value.trim().toLowerCase();
      renderProducts(visibleProducts());
    });
  }
  if (sortByNameBtn && !sortByNameBtn.dataset.initialized) {
    sortByNameBtn.dataset.initialized = 'true';
    sortByNameBtn.addEventListener('click', () => {
      adminSort = { key: 'name', asc: adminSort.key === 'name' ? !adminSort.asc : true };
      renderProducts(visibleProducts());
    });
  }
  if (sortByPriceBtn && !sortByPriceBtn.dataset.initialized) {
    sortByPriceBtn.dataset.initialized = 'true';
    sortByPriceBtn.addEventListener('click', () => {
      adminSort = { key: 'price', asc: adminSort.key === 'price' ? !adminSort.asc : true };
      renderProducts(visibleProducts());
    });
  }

  renderProducts(visibleProducts());
}

/* ---------- Precio normal con separador de miles (puntos) ---------- */
function setupPriceFormatter() {
  const priceInput = $('#prodPrice');
  if (!priceInput || priceInput.dataset.formatted) return;
  priceInput.dataset.formatted = 'true';
  priceInput.type = 'text';
  priceInput.inputMode = 'numeric';
  priceInput.autocomplete = 'off';

  priceInput.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    e.target.value = digits ? dots(digits) : '';
  });
}

/* ---------- Pedidos, métricas, filtros y exportación Excel ---------- */
const LEAD_LABELS = { new: 'Nuevo', chatting: 'Conversando', sold: 'Vendido', lost: 'Perdido' };
const leadFilters = { search: '', seller: '', status: '', date: 'all' };

function getLeadTotalGs(lead) {
  return (lead.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price_gs) || 0), 0);
}

function setupLeadsControls() {
  const sellerSel = $('#leadSellerFilter');
  if (sellerSel) {
    const currentVal = leadFilters.seller;
    const sellerNames = new Set();
    for (const s of state.data?.sellers || []) {
      const n = String(s.name || '').trim();
      if (n) sellerNames.add(n);
    }
    for (const l of state.data?.leads || []) {
      const n = String(l.seller_name || '').trim();
      if (n) sellerNames.add(n);
    }
    const sorted = Array.from(sellerNames).sort((a, b) => a.localeCompare(b, 'es'));
    sellerSel.innerHTML =
      `<option value="">Vendedor: Todos</option>` +
      `<option value="__none__">Sin vendedor (Admin)</option>` +
      sorted.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    sellerSel.value = currentVal;

    if (!sellerSel.dataset.initialized) {
      sellerSel.dataset.initialized = 'true';
      sellerSel.addEventListener('change', (e) => {
        leadFilters.seller = e.target.value;
        renderLeads();
      });
    }
  }

  const searchEl = $('#leadSearchInput');
  if (searchEl && !searchEl.dataset.initialized) {
    searchEl.dataset.initialized = 'true';
    searchEl.addEventListener('input', (e) => {
      leadFilters.search = e.target.value.trim().toLowerCase();
      renderLeads();
    });
  }

  const statusEl = $('#leadStatusFilter');
  if (statusEl && !statusEl.dataset.initialized) {
    statusEl.dataset.initialized = 'true';
    statusEl.addEventListener('change', (e) => {
      leadFilters.status = e.target.value;
      renderLeads();
    });
  }

  const dateEl = $('#leadDateFilter');
  if (dateEl && !dateEl.dataset.initialized) {
    dateEl.dataset.initialized = 'true';
    dateEl.addEventListener('change', (e) => {
      leadFilters.date = e.target.value;
      renderLeads();
    });
  }

  const exportBtn = $('#exportLeadsBtn');
  if (exportBtn && !exportBtn.dataset.initialized) {
    exportBtn.dataset.initialized = 'true';
    exportBtn.addEventListener('click', exportLeadsToExcel);
  }
}

function getFilteredLeads() {
  const all = state.data?.leads || [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;

  return all.filter((l) => {
    if (isSellerSession()) {
      const myId = Number(state.data?.session?.sellerId);
      const myName = String(state.data?.session?.name || '').trim().toLowerCase();
      const leadSellerId = Number(l.seller_id || 0);
      const leadSellerName = String(l.seller_name || '').trim().toLowerCase();
      if (leadSellerId !== myId && (!myName || leadSellerName !== myName)) return false;
    }

    if (leadFilters.status && l.status !== leadFilters.status) return false;

    if (!isSellerSession()) {
      if (leadFilters.seller === '__none__') {
        if (String(l.seller_name || '').trim() !== '') return false;
      } else if (leadFilters.seller) {
        if (String(l.seller_name || '').trim() !== leadFilters.seller) return false;
      }
    }

    const ts = Number(l.created_at) || 0;
    if (leadFilters.date === 'today' && ts < startOfToday) return false;
    if (leadFilters.date === '7d' && ts < sevenDaysAgo) return false;
    if (leadFilters.date === 'month' && ts < startOfMonth) return false;

    if (leadFilters.search) {
      const itemsStr = (l.items || []).map((it) => it.product_name || '').join(' ');
      const haystack = `${l.ref || ''} ${l.customer_name || ''} ${l.customer_phone || ''} ${l.seller_name || ''} ${itemsStr} ${l.note || ''}`.toLowerCase();
      if (!haystack.includes(leadFilters.search)) return false;
    }

    return true;
  });
}

function renderLeadMetrics(leads) {
  const box = $('#leadsMetrics');
  if (!box) return;

  const total = leads.length;
  const soldList = leads.filter((l) => l.status === 'sold');
  const pendingCount = leads.filter((l) => l.status === 'new' || l.status === 'chatting').length;
  const soldGs = soldList.reduce((acc, l) => acc + getLeadTotalGs(l), 0);
  const convRate = total > 0 ? Math.round((soldList.length / total) * 100) : 0;

  box.innerHTML = `
    <div class="metric-card">
      <p class="metric-label">Consultas</p>
      <p class="metric-val">${total}</p>
      <p class="metric-sub">${pendingCount} pendientes</p>
    </div>
    <div class="metric-card">
      <p class="metric-label">Vendidos</p>
      <p class="metric-val" style="color:#15803d;">${soldList.length}</p>
      <p class="metric-sub">Conversión: ${convRate}%</p>
    </div>
    <div class="metric-card">
      <p class="metric-label">Total vendido</p>
      <p class="metric-val" style="color:#e11d48;">${fmtGs(soldGs)}</p>
      <p class="metric-sub">Según filtro actual</p>
    </div>
  `;
}

function exportLeadsToExcel() {
  const leads = getFilteredLeads();
  if (!leads.length) {
    alert('No hay pedidos para exportar con el filtro actual.');
    return;
  }

  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['Fecha y Hora', 'Ref', 'Estado', 'Vendedor', 'Productos', 'Cantidad Total', 'Monto Total (Gs.)', 'Cliente', 'Teléfono', 'Nota'];

  const rows = leads.map((l) => {
    const fecha = l.created_at ? new Date(l.created_at * 1000).toLocaleString('es-PY') : '';
    const itemsText = (l.items || []).map((it) => `${it.qty}x ${it.product_name} (${fmtGs(it.unit_price_gs)})`).join(' | ');
    const qtyTotal = (l.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const totalGs = getLeadTotalGs(l);

    return [
      fecha,
      l.ref || ('#' + l.id),
      LEAD_LABELS[l.status] || l.status || '',
      l.seller_name || 'Administrador',
      itemsText,
      qtyTotal,
      totalGs,
      l.customer_name || 'Cliente',
      l.customer_phone || '',
      l.note || ''
    ].map(csvCell).join(';');
  });

  const csvContent = '\uFEFF' + [headers.map(csvCell).join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pedidos-regalafacil-${stamp}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderLeads() {
  const list = $('#leadsList');
  const leads = getFilteredLeads();
  renderLeadMetrics(leads);

  if (!leads.length) {
    list.innerHTML = '<p class="muted">No hay pedidos que coincidan con el filtro.</p>';
    return;
  }

  list.innerHTML = leads.map((l) => {
    const items = l.items || [];
    const itemsHtml = items.length
      ? items.map((it) => `<div>• ${it.qty}x <strong>${escapeHtml(it.product_name)}</strong> (${fmtGs(it.unit_price_gs)})</div>`).join('')
      : '<div class="muted">Sin detalle de producto</div>';
    const totalGs = getLeadTotalGs(l);
    const wa = waLink(l.customer_phone);

    return `
      <article class="card">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong>Ref ${escapeHtml(l.ref || ('#' + l.id))}</strong>
              <span class="pill">👤 ${escapeHtml(l.seller_name || 'Administrador')}</span>
              ${totalGs > 0 ? `<span class="pill pill-ok">${fmtGs(totalGs)}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <select data-lead-status="${l.id}" style="padding:5px 8px;border-radius:8px;border:1px solid #d0d5dd;background:#fff;">
                ${Object.entries(LEAD_LABELS).map(([val, label]) =>
                  `<option value="${val}" ${l.status === val ? 'selected' : ''}>${label}</option>`
                ).join('')}
              </select>
              <button type="button" class="btn btn-danger btn-sm" data-delete-lead="${l.id}" title="Eliminar pedido" style="padding:5px 8px;">✕</button>
            </div>
          </div>
          <p class="muted" style="margin:6px 0 4px;font-size:12px;">📅 ${l.created_at ? new Date(l.created_at * 1000).toLocaleString('es-PY') : ''}</p>
          <p style="margin:4px 0;"><strong>${escapeHtml(l.customer_name || 'Cliente')}</strong>${l.customer_phone ? ' · ' + escapeHtml(l.customer_phone) : ''}</p>
          <div style="margin:6px 0;font-size:13px;line-height:1.45;">${itemsHtml}</div>
          ${l.note ? `<p class="muted" style="margin:4px 0 0;">Nota: ${escapeHtml(l.note)}</p>` : ''}
          ${wa ? `<p style="margin:8px 0 0;"><a class="btn btn-ghost btn-sm" href="${wa}" target="_blank" rel="noopener">Escribir por WhatsApp</a></p>` : ''}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-lead-status]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = Number(sel.dataset.leadStatus);
      const newStatus = sel.value;
      try {
        await api('/api/admin/leads', {
          method: 'PUT',
          body: JSON.stringify({ id, status: newStatus })
        });
        const target = (state.data?.leads || []).find((x) => x.id === id);
        if (target) target.status = newStatus;
        renderLeads();
      } catch (err) {
        alert(err.message);
        await refreshBootstrap();
      }
    });
  });

  list.querySelectorAll('[data-delete-lead]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.deleteLead);
      if (!confirm('¿Eliminar este pedido del historial?')) return;
      try {
        await api(`/api/admin/leads?id=${id}`, { method: 'DELETE' });
        state.data.leads = (state.data.leads || []).filter((x) => x.id !== id);
        renderLeads();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

/* ---------- Selector de modo (Carga directa vs IA) y Asistente IA ---------- */
let aiBatchItems = [];
let aiBatchIndex = 0;

function setProductModalMode(mode) {
  const isAi = mode === 'ai';
  const aiSec = $('#aiModeSection');
  if (aiSec) aiSec.hidden = !isAi;
  $('#tabModeManual')?.classList.toggle('active', !isAi);
  $('#tabModeAi')?.classList.toggle('active', isAi);
}

$('#tabModeManual')?.addEventListener('click', () => setProductModalMode('manual'));
$('#tabModeAi')?.addEventListener('click', () => setProductModalMode('ai'));

function resetAiAssistantUi() {
  aiBatchItems = [];
  aiBatchIndex = 0;
  if ($('#aiPromptBox')) $('#aiPromptBox').hidden = true;
  if ($('#aiJsonInput')) $('#aiJsonInput').value = '';
  if ($('#aiBatchNav')) $('#aiBatchNav').hidden = true;
  if ($('#aiHelperMsg')) $('#aiHelperMsg').textContent = '';
  setProductModalMode('manual');
}

function buildAiPrompt(city, phone, sellerName) {
  const categoriesList = (state.data?.categories || []).map((c) => c.name).join(', ') || 'General';
  return [
    'Respondé ÚNICAMENTE con el código JSON dentro de un bloque de código Markdown JSON.stringify(...), sin texto ni explicaciones antes ni después, para que aparezca el botón de Copiar. Usá esta estructura:',
    'Actuá como redactor comercial experto para la tienda RegaláFácil PY (Paraguay). Analizá cada foto de forma independiente.',
    'REGLAS ESTRICTAS:',
    '- NO describas lo obvio de la imagen (NO digas "frasco azul", "caja original azul", "en la foto se ve...", ni pongas "[Foto #1]").',
    '- NO inventes precios ni datos que no estén claros. Si el precio no se lee, dejalo en 0 y poné "requiere_revision": true.',
    '- Detectá oferta ("tiene_oferta": true) SOLO si hay dos precios claros (actual y anterior/tachado).',
    '- Redactá la "descripcion" en máximo 2 frases cortas y vendedoras (máx. 180 caracteres) con esta fórmula:',
    '  1) Identificación (Nombre exacto del producto, sin incluir el nombre de la tienda): transmite seguridad y prestigio inmediato.',
    '  2) El Diferenciador (Característica clave): qué lo hace mejor o ideal para regalar (ej: concentración Parfum, 100 ml, acero inox 24h, etc.).',
    '- Redactá "detalle_corto" como un gancho rápido de máximo 65 caracteres con el diferenciador principal.',
    `Usá esta ciudad para todos los productos: "${city}".`,
    `Usá este teléfono de contacto: "${phone}"${sellerName ? ` (Tienda: ${sellerName})` : ''}.`,
    `Categorías disponibles (usá el nombre exacto si encaja): ${categoriesList}.`,
    'Respondé ÚNICAMENTE con un JSON válido (sin texto antes ni después) con esta estructura:',
    JSON.stringify({
      productos: [
        {
          nombre: 'Marca y nombre comercial del producto',
          detalle_corto: 'Diferenciador clave corto (máx. 65 caracteres)',
          descripcion: 'Descripción comercial corta (identificación + diferenciador clave, sin relleno).',
          precio: 220000,
          tiene_oferta: false,
          precio_anterior: null,
          categoria: '',
          ciudad: city,
          telefono: phone,
          requiere_revision: false
        }
      ]
    }, null, 2)
  ].join('\n');
}

function parseAiJsonText(rawText) {
  let clean = String(rawText || '').trim();
  if (!clean) throw new Error('Pegá primero el JSON que devolvió la IA.');

  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) clean = fenced[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('El texto pegado no es un JSON válido. Revisá que no tenga texto extra o comas de más.');
  }

  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.productos)) return parsed.productos;
  if (parsed && typeof parsed === 'object' && (parsed.nombre || parsed.precio)) return [parsed];

  throw new Error('El JSON debe contener un objeto o un arreglo "productos".');
}

function applyAiItemToForm(item) {
  if (!item || typeof item !== 'object') return;

  if (item.nombre) $('#prodName').value = String(item.nombre).trim().slice(0, 120);

  const normalPrice = digitsToInt(item.precio_anterior || item.precio);
  const promoPrice = digitsToInt(item.tiene_oferta ? item.precio : item.precio_oferta);

  if (normalPrice > 0) {
    $('#prodPrice').value = dots(normalPrice);
  }
  if (promoPrice > 0) {
    $('#prodOfferPrice').value = String(promoPrice);
    if ($('#accOffer')) $('#accOffer').open = true;
  } else {
    $('#prodOfferPrice').value = '';
    $('#prodOfferEnds').value = '';
  }

  if (item.ciudad && $('#prodCity')) {
    $('#prodCity').value = String(item.ciudad).trim().slice(0, 80);
  }

  if (item.descripcion) {
    const cleanDesc = String(item.descripcion).replace(/^\[Foto\s*#\d+\]\s*/i, '').trim();
    $('#prodDesc').value = cleanDesc.slice(0, 1000);
  }

  const shortDetailInput = $('#prodShortDetail');
  if (shortDetailInput) {
    const sd = String(item.detalle_corto || item.detalleCorto || '').trim().slice(0, 90);
    shortDetailInput.value = sd;
  }

  if (item.categoria && $('#prodCategory')) {
    const targetCat = String(item.categoria).trim().toLowerCase();
    const match = (state.data?.categories || []).find((c) => String(c.name || '').trim().toLowerCase() === targetCat);
    if (match) $('#prodCategory').value = String(match.id);
  }

  const helper = $('#aiHelperMsg');
  if (helper) {
    helper.textContent = item.requiere_revision
      ? '⚠️ Revisá el precio o detalle abajo antes de guardar.'
      : '✅ Datos rellenados abajo. Subí tus fotos en el Paso 1 y tocá Guardar.';
  }
}

function updateAiBatchNav() {
  const nav = $('#aiBatchNav');
  const counter = $('#aiBatchCounter');
  if (!nav || !counter) return;

  if (aiBatchItems.length > 1) {
    nav.hidden = false;
    counter.textContent = `${aiBatchIndex + 1} / ${aiBatchItems.length}`;
  } else {
    nav.hidden = true;
  }
}

function setupAiAssistantControls() {
  const genBtn = $('#genAiPromptBtn');
  if (genBtn && !genBtn.dataset.listener) {
    genBtn.dataset.listener = 'true';
    genBtn.addEventListener('click', async () => {
      const sellerSelect = $('#prodSeller');
      const selectedSeller = isSellerSession()
        ? getMySellerRecord()
        : (sellerSelect?.value ? (state.data?.sellers || []).find((s) => String(s.id) === String(sellerSelect.value)) : null);

      let city = String($('#prodCity')?.value || selectedSeller?.city || '').trim();
      if (!city) {
        const askedCity = prompt('¿De qué ciudad son los productos? (Ej: Villa Elisa, Asunción)');
        if (askedCity === null) return;
        city = askedCity.trim();
        if (!city) {
          alert('Necesitás ingresar una ciudad para armar las instrucciones.');
          return;
        }
        if ($('#prodCity')) $('#prodCity').value = city;
      }

      const defaultPhone = selectedSeller?.phone || state.data?.settings?.business?.default_phone || '';
      let phone = String(defaultPhone || '').trim();
      if (!phone) {
        const askedPhone = prompt('¿Cuál es el WhatsApp del vendedor? (Ej: 0981 123 456)');
        if (askedPhone === null) return;
        phone = askedPhone.trim();
        if (!phone) {
          alert('Necesitás ingresar un teléfono para armar las instrucciones.');
          return;
        }
      }

      const promptText = buildAiPrompt(city, phone, selectedSeller?.name || '');
      if ($('#aiPromptOutput')) $('#aiPromptOutput').value = promptText;

      try {
        await navigator.clipboard.writeText(promptText);
        $('#aiHelperMsg').textContent = '✅ ¡Instrucciones copiadas! Ahora abrí Gemini o ChatGPT, pegá el texto y subí tus fotos.';
      } catch {
        if ($('#aiPromptBox')) $('#aiPromptBox').hidden = false;
        $('#aiPromptOutput')?.select();
        document.execCommand('copy');
        $('#aiHelperMsg').textContent = '✅ Instrucciones listas. Pegalas en Gemini o ChatGPT junto con tus fotos.';
      }
    });
  }

  const applyBtn = $('#applyAiJsonBtn');
  if (applyBtn && !applyBtn.dataset.listener) {
    applyBtn.dataset.listener = 'true';
    applyBtn.addEventListener('click', () => {
      try {
        const items = parseAiJsonText($('#aiJsonInput')?.value || '');
        aiBatchItems = items;
        aiBatchIndex = 0;
        updateAiBatchNav();
        applyAiItemToForm(aiBatchItems[0]);
        if (items.length === 1) setProductModalMode('manual');
      } catch (err) {
        $('#aiHelperMsg').textContent = `❌ ${err.message}`;
      }
    });
  }

  const createAllBtn = $('#createAllAiJsonBtn');
  if (createAllBtn && !createAllBtn.dataset.listener) {
    createAllBtn.dataset.listener = 'true';
    createAllBtn.addEventListener('click', async () => {
      try {
        const items = parseAiJsonText($('#aiJsonInput')?.value || '');
        if (!items.length) throw new Error('No hay productos en el JSON.');

        const sellerIdVal = isSellerSession()
          ? Number(state.data?.session?.sellerId)
          : ($('#prodSeller')?.value ? Number($('#prodSeller').value) : null);
        const fallbackCity = String($('#prodCity')?.value || getMySellerRecord()?.city || '').trim();
        let createdCount = 0;

        createAllBtn.disabled = true;
        $('#aiHelperMsg').textContent = `Creando ${items.length} productos...`;

        for (const item of items) {
          const name = String(item?.nombre || '').trim().slice(0, 120);
          if (!name) continue;

          const normalPrice = digitsToInt(item?.precio_anterior || item?.precio);
          const promoPrice = digitsToInt(item?.tiene_oferta ? item?.precio : item?.precio_oferta);
          const finalPrice = normalPrice > 0 ? normalPrice : (promoPrice > 0 ? promoPrice : 1000);
          const validOffer = promoPrice > 0 && promoPrice < finalPrice ? promoPrice : 0;

          const cityVal = String(item?.ciudad || fallbackCity || '').trim().slice(0, 80);
          const shortDetailVal = String(item?.detalle_corto || item?.detalleCorto || '').trim().slice(0, 90);
          const descVal = String(item?.descripcion || '').replace(/^\[Foto\s*#\d+\]\s*/i, '').trim().slice(0, 1000);

          let categoryId = $('#prodCategory')?.value ? Number($('#prodCategory').value) : null;
          if (item?.categoria) {
            const targetCat = String(item.categoria).trim().toLowerCase();
            const match = (state.data?.categories || []).find((c) => String(c.name || '').trim().toLowerCase() === targetCat);
            if (match) categoryId = Number(match.id);
          }

          const attrs = {
            colors: [],
            ...(cityVal ? { city: cityVal } : {}),
            ...(shortDetailVal ? { short_detail: shortDetailVal } : {}),
            ...(sellerIdVal ? { seller_id: sellerIdVal } : {})
          };

          await api('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify({
              name,
              price_gs: finalPrice,
              offer_price_gs: validOffer,
              offer_ends_at: null,
              category_id: categoryId,
              status: 'active',
              seller_id: sellerIdVal,
              city: cityVal,
              attributes: attrs,
              description: descVal,
              tag_ids: [],
              image_ids: [],
              colors: '[]'
            })
          });
          createdCount++;
        }

        await refreshBootstrap();
        $('#productModal').close();
        alert(`Listo: se crearon ${createdCount} productos. Ahora entrá a Editar en cada uno para subir su foto.`);
      } catch (err) {
        $('#aiHelperMsg').textContent = `❌ ${err.message}`;
      } finally {
        createAllBtn.disabled = false;
      }
    });
  }

  const prevBtn = $('#aiPrevBtn');
  if (prevBtn && !prevBtn.dataset.listener) {
    prevBtn.dataset.listener = 'true';
    prevBtn.addEventListener('click', () => {
      if (!aiBatchItems.length) return;
      aiBatchIndex = (aiBatchIndex - 1 + aiBatchItems.length) % aiBatchItems.length;
      updateAiBatchNav();
      applyAiItemToForm(aiBatchItems[aiBatchIndex]);
    });
  }

  const nextBtn = $('#aiNextBtn');
  if (nextBtn && !nextBtn.dataset.listener) {
    nextBtn.dataset.listener = 'true';
    nextBtn.addEventListener('click', () => {
      if (!aiBatchItems.length) return;
      aiBatchIndex = (aiBatchIndex + 1) % aiBatchItems.length;
      updateAiBatchNav();
      applyAiItemToForm(aiBatchItems[aiBatchIndex]);
    });
  }
}

/* ---------- Formulario de producto (Categorías y Etiquetas agrupadas) ---------- */
const AGE_RANGE_LABELS = {
  'niño/a': 'Niño/a (0–11 años)',
  'nino/a': 'Niño/a (0–11 años)',
  'joven': 'Joven (12–25 años)',
  'adulto': 'Adulto (26–59 años)',
  'adulto mayor': 'Adulto mayor (60+ años)'
};

function formatTagLabel(rawLabel) {
  const clean = String(rawLabel || '').trim();
  return AGE_RANGE_LABELS[clean.toLowerCase()] || clean;
}

function classifyTagGroup(tag) {
  const gk = String(tag.group_key || '').toLowerCase();
  const lbl = String(tag.label || '').toLowerCase();
  if (gk === 'age' || lbl.includes('niño') || lbl.includes('nino') || lbl.includes('joven') || lbl.includes('adulto')) {
    return 'age';
  }
  if (gk === 'occasion' || lbl.includes('cumple') || lbl.includes('navidad') || lbl.includes('aniversario') || lbl.includes('valent')) {
    return 'occasion';
  }
  return 'recipient';
}

function populateFormOptions() {
  const cats = state.data?.categories || [];
  $('#prodCategory').innerHTML = `<option value="">Seleccionar categoría...</option>` +
    cats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const tags = state.data?.tags || [];
  const groups = { recipient: [], age: [], occasion: [] };
  for (const t of tags) {
    groups[classifyTagGroup(t)].push(t);
  }

  const renderChips = (arr) => arr.map((t) => `
    <label class="chip-check" style="white-space:nowrap;">
      <input type="checkbox" value="${t.id}" />
      <span>${escapeHtml(formatTagLabel(t.label))}</span>
    </label>
  `).join('');

  const sections = [];
  if (groups.recipient.length) {
    sections.push(`
      <div class="tag-group-box">
        <p class="tag-group-title">👤 ¿Para quién? (Hombre / Mujer / Relación)</p>
        <div class="chips-wrap">${renderChips(groups.recipient)}</div>
      </div>
    `);
  }
  if (groups.age.length) {
    sections.push(`
      <div class="tag-group-box">
        <p class="tag-group-title">🎂 Rango de edad</p>
        <div class="chips-wrap">${renderChips(groups.age)}</div>
      </div>
    `);
  }
  if (groups.occasion.length) {
    sections.push(`
      <div class="tag-group-box">
        <p class="tag-group-title">🎉 Ocasión especial</p>
        <div class="chips-wrap">${renderChips(groups.occasion)}</div>
      </div>
    `);
  }

  $('#prodTags').innerHTML = sections.join('');

  const sellerSelect = $('#prodSeller');
  if (sellerSelect) {
    const sellers = state.data?.sellers || [];
    sellerSelect.innerHTML = `<option value="">Administrador (por defecto)</option>` +
      sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}${s.city ? ' — ' + escapeHtml(s.city) : ''}</option>`).join('');

    if (isSellerSession()) {
      sellerSelect.value = String(state.data.session.sellerId);
      sellerSelect.disabled = true;
    } else {
      sellerSelect.disabled = false;
    }

    if (!sellerSelect.dataset.listener) {
      sellerSelect.dataset.listener = 'true';
      sellerSelect.addEventListener('change', () => {
        const cityInput = $('#prodCity');
        if (!cityInput || cityInput.value.trim()) return;
        const selected = (state.data?.sellers || []).find((s) => String(s.id) === String(sellerSelect.value));
        if (selected?.city) cityInput.value = selected.city;
      });
    }
  }

  const cityDatalist = $('#prodCityOptions');
  if (cityDatalist) {
    const citiesSet = new Set();
    for (const s of state.data?.sellers || []) {
      const c = String(s.city || '').trim();
      if (c) citiesSet.add(c);
    }
    for (const p of state.data?.products || []) {
      const c = String(p.attributes?.city || '').trim();
      if (c) citiesSet.add(c);
    }
    const sortedCities = Array.from(citiesSet).sort((a, b) => a.localeCompare(b, 'es'));
    cityDatalist.innerHTML = sortedCities.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
  }

  setupAiAssistantControls();
}

/* ---------- Gestión completa de Fotos (Portada + Galería ordenable desde nuevo o edición) + Colores ---------- */
let productVariants = [];
let mainPhotoId = null;
let galleryItems = [];
let mainPreviewUrl = null;

function clearPendingGalleryUrls() {
  for (const item of galleryItems) {
    if (item.type === 'pending' && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}

function syncVariantsWithImages() {
  const validIds = new Set();
  if (mainPhotoId) validIds.add(Number(mainPhotoId));
  for (const item of galleryItems) {
    if (item.type === 'saved' && item.id) validIds.add(Number(item.id));
  }

  let changed = false;
  for (const v of productVariants) {
    if (v.image_id && !validIds.has(Number(v.image_id))) {
      v.image_id = null;
      changed = true;
    }
  }
  if (changed) renderVariantsForm(productVariants);
}

function renderImagesSection() {
  renderMainPreview();
  renderGallery();
  renderVariantsForm(productVariants);
}

function renderMainPreview() {
  const box = $('#prodImagePreview');
  const dropLabel = $('#photoDropLabel');
  if (!box) return;

  if (mainPreviewUrl) {
    URL.revokeObjectURL(mainPreviewUrl);
    mainPreviewUrl = null;
  }

  let src = '';
  let note = '';
  if (state.selectedFile) {
    mainPreviewUrl = URL.createObjectURL(state.selectedFile);
    src = mainPreviewUrl;
    note = '✅ Foto principal lista.';
  } else if (mainPhotoId) {
    src = imgUrl(mainPhotoId);
  }

  if (!src) {
    if (dropLabel) dropLabel.style.display = 'flex';
    box.innerHTML = '';
    return;
  }

  if (dropLabel) dropLabel.style.display = 'none';
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;">
      <img src="${src}" alt="Foto principal" style="width:86px;height:86px;object-fit:cover;border-radius:10px;display:block;flex-shrink:0;" />
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
        <span style="font-size:13px;font-weight:700;color:#0f172a;">⭐ Foto de portada</span>
        ${note ? `<small style="color:#15803d;font-weight:600;font-size:12px;">${note}</small>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <label for="prodImageFile" class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0;background:#fff;border:1px solid #cbd5e1;">Cambiar portada</label>
          <button type="button" id="removeMainPhotoBtn" class="btn btn-danger btn-sm">Quitar</button>
        </div>
      </div>
    </div>
  `;
  $('#removeMainPhotoBtn')?.addEventListener('click', removeMainPhoto);
}

async function removeMainPhoto() {
  if (state.selectedFile) {
    state.selectedFile = null;
    $('#prodImageFile').value = '';
    renderImagesSection();
    return;
  }

  if (!mainPhotoId) return;
  if (!confirm('¿Eliminar la foto principal del producto?')) return;

  try {
    await api(`/api/admin/image?id=${mainPhotoId}`, { method: 'DELETE' });
  } catch (err) {
    alert(err.message);
    return;
  }

  mainPhotoId = null;
  syncVariantsWithImages();
  renderImagesSection();
}

function renderGallery() {
  const container = $('#productImagesGallery');
  if (!container) return;

  if (!galleryItems.length) {
    container.innerHTML = '<p class="muted" style="font-size:12px;margin:0;">Aún no agregaste fotos adicionales.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:8px;" id="dragGalleryContainer">
      ${galleryItems.map((item, idx) => {
        const thumbSrc = item.type === 'saved' ? imgUrl(item.id) : item.previewUrl;
        return `
          <div draggable="true" data-index="${idx}" class="draggable-thumb" style="position:relative; width:88px; height:102px; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; background:#fff; padding:4px; text-align:center; cursor:grab; display:flex; flex-direction:column; justify-content:space-between; align-items:center;">
            <button type="button" data-remove-gal-idx="${idx}" aria-label="Eliminar foto" style="position:absolute; top:4px; right:4px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.2);">✕</button>
            <img src="${thumbSrc}" alt="" style="width:100%; height:68px; object-fit:cover; border-radius:6px; pointer-events:none;" />
            <span style="font-size:11px; color:#475569; font-weight:600;">Foto #${idx + 1}</span>
          </div>
        `;
      }).join('')}
    </div>
    <small class="muted" style="display:block; margin-top:8px;">💡 Arrastrá las fotos adicionales para cambiar su orden.</small>
  `;

  container.querySelectorAll('[data-remove-gal-idx]').forEach((btn) => {
    btn.addEventListener('click', () => removeGalleryItemAt(Number(btn.dataset.removeGalIdx)));
  });

  setupDragAndDrop();
}

async function removeGalleryItemAt(index) {
  const item = galleryItems[index];
  if (!item) return;

  if (item.type === 'saved') {
    if (!confirm('¿Eliminar esta foto de la galería?')) return;
    try {
      await api(`/api/admin/image?id=${item.id}`, { method: 'DELETE' });
    } catch (err) {
      alert(err.message);
      return;
    }
  } else if (item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }

  galleryItems.splice(index, 1);
  syncVariantsWithImages();
  renderImagesSection();
}

function setupDragAndDrop() {
  const container = $('#dragGalleryContainer');
  if (!container) return;

  let draggedIndex = null;

  container.querySelectorAll('.draggable-thumb').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      draggedIndex = Number(item.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetIndex = Number(item.dataset.index);
      if (draggedIndex !== null && draggedIndex !== targetIndex) {
        const moved = galleryItems.splice(draggedIndex, 1)[0];
        galleryItems.splice(targetIndex, 0, moved);
        draggedIndex = null;
        renderImagesSection();
      }
    });
  });
}

const addMoreImagesBtn = $('#addMoreImagesBtn');
if (addMoreImagesBtn && !addMoreImagesBtn.dataset.listener) {
  addMoreImagesBtn.dataset.listener = 'true';
  addMoreImagesBtn.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = Math.max(0, 7 - galleryItems.length);
    if (remainingSlots <= 0) {
      alert('Ya alcanzaste el máximo de 7 fotos adicionales en la galería.');
      e.target.value = '';
      return;
    }

    const toProcess = files.slice(0, remainingSlots);
    const prodId = Number($('#prodId').value);

    for (const file of toProcess) {
      try {
        const compressed = await compressImageFile(file);
        if (prodId) {
          const fd = new FormData();
          fd.append('product_id', String(prodId));
          fd.append('file', compressed, 'photo');
          const res = await api('/api/admin/image', { method: 'POST', body: fd });
          if (res && res.id) {
            galleryItems.push({ type: 'saved', id: Number(res.id) });
          }
        } else {
          const previewUrl = URL.createObjectURL(compressed);
          galleryItems.push({ type: 'pending', blob: compressed, previewUrl });
        }
      } catch (err) {
        alert(`No se pudo procesar una de las fotos: ${err.message}`);
      }
    }

    e.target.value = '';
    syncVariantsWithImages();
    renderImagesSection();
  });
}

function renderVariantsForm(variants = productVariants) {
  productVariants = variants;
  const container = $('#productVariantsList');
  if (!container) return;

  if (!variants.length) {
    container.innerHTML = '<p class="muted" style="font-size:12px;margin:0;">Sin variantes añadidas.</p>';
    return;
  }

  const savedGallery = galleryItems.filter((it) => it.type === 'saved');

  container.innerHTML = variants.map((v, index) => `
    <div style="display:flex; gap:6px; align-items:center; background:#fff; padding:8px; border-radius:8px; border:1px solid #e2e8f0; flex-wrap:wrap;">
      <input type="text" value="${escapeHtml(v.name || '')}" placeholder="Ej: Negro, Rosa, Talle M..." data-variant-name="${index}" style="flex:1; min-width:120px; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px;" />

      <select data-variant-img="${index}" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px; background:#fff;">
        <option value="">📸 Foto por defecto</option>
        ${mainPhotoId ? `<option value="${mainPhotoId}" ${Number(v.image_id) === Number(mainPhotoId) ? 'selected' : ''}>⭐ Foto principal (Portada)</option>` : ''}
        ${savedGallery.map((it, gIdx) => `
          <option value="${it.id}" ${Number(v.image_id) === Number(it.id) ? 'selected' : ''}>Foto #${gIdx + 1}</option>
        `).join('')}
      </select>

      <button type="button" class="btn btn-danger btn-sm" onclick="removeVariant(${index})" style="padding:4px 8px;">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-variant-name]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.variantName);
      if (productVariants[idx]) productVariants[idx].name = e.target.value;
    });
  });

  container.querySelectorAll('[data-variant-img]').forEach((select) => {
    select.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.variantImg);
      if (productVariants[idx]) {
        productVariants[idx].image_id = e.target.value ? Number(e.target.value) : null;
      }
    });
  });
}

window.removeVariant = function (index) {
  productVariants.splice(index, 1);
  renderVariantsForm(productVariants);
};

const addVariantBtn = $('#addVariantBtn');
if (addVariantBtn && !addVariantBtn.dataset.listener) {
  addVariantBtn.dataset.listener = 'true';
  addVariantBtn.addEventListener('click', () => {
    productVariants.push({ name: '', image_id: null });
    renderVariantsForm(productVariants);
  });
}

function openProductModal(prod = null) {
  state.editingProduct = prod;
  state.selectedFile = null;
  clearPendingGalleryUrls();
  galleryItems = [];
  $('#prodImageFile').value = '';
  $('#productFormError').hidden = true;
  resetAiAssistantUi();

  const ownerRow = $('#prodOwnerRow');
  if (ownerRow) ownerRow.hidden = isSellerSession();

  let variants = [];
  try {
    const raw = prod && prod.colors ? (typeof prod.colors === 'string' ? JSON.parse(prod.colors) : prod.colors) : [];
    variants = (Array.isArray(raw) ? raw : []).map((v) => ({
      name: String(v?.name ?? v ?? '').trim(),
      image_id: v?.image_id || null
    }));
  } catch {
    variants = [];
  }
  productVariants = variants;

  const ids = prod ? (prod.images ? prod.images.map((i) => i.id) : (prod.image_ids || [])) : [];
  mainPhotoId = ids.length > 0 ? ids[0] : null;
  galleryItems = ids.slice(1).map((id) => ({ type: 'saved', id: Number(id) }));

  renderImagesSection();

  if (prod) {
    $('#productModalTitle').textContent = 'Editar producto';
    $('#prodId').value = prod.id;
    $('#prodName').value = prod.name || '';
    $('#prodPrice').value = dots(prod.price_gs);
    const hasOffer = offerActive(prod);
    $('#prodOfferPrice').value = hasOffer ? prod.offer_price_gs : '';
    $('#prodOfferEnds').value = hasOffer ? toLocalInput(prod.offer_ends_at) : '';
    $('#prodCategory').value = prod.category_id || '';
    $('#prodStatus').value = prod.status || 'active';
    const sellerSelect = $('#prodSeller');
    if (sellerSelect) {
      sellerSelect.value = isSellerSession()
        ? String(state.data.session.sellerId)
        : (prod.seller_id || prod.attributes?.seller_id ? String(prod.seller_id || prod.attributes.seller_id) : '');
    }
    const cityInput = $('#prodCity');
    if (cityInput) cityInput.value = prod.attributes?.city || getMySellerRecord()?.city || '';
    $('#prodDesc').value = prod.description || '';
    const shortDetailInput = $('#prodShortDetail');
    if (shortDetailInput) shortDetailInput.value = prod.attributes?.short_detail || '';
    $('#deleteProductBtn').hidden = false;

    const selectedTags = new Set(prod.tag_ids || []);
    $('#prodTags').querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = selectedTags.has(Number(cb.value));
    });

    if ($('#accOffer')) $('#accOffer').open = hasOffer;
  } else {
    $('#productModalTitle').textContent = 'Nuevo producto';
    $('#productForm').reset();
    $('#prodId').value = '';
    $('#prodStatus').value = 'active';
    const sellerSelect = $('#prodSeller');
    if (sellerSelect) {
      sellerSelect.value = isSellerSession() ? String(state.data.session.sellerId) : '';
    }
    const cityInput = $('#prodCity');
    if (cityInput) cityInput.value = isSellerSession() ? (getMySellerRecord()?.city || '') : '';
    const shortDetailInput = $('#prodShortDetail');
    if (shortDetailInput) shortDetailInput.value = '';
    $('#prodTags').querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
    mainPhotoId = null;
    galleryItems = [];
    productVariants = [];
    renderImagesSection();
    $('#deleteProductBtn').hidden = true;
    if ($('#accOffer')) $('#accOffer').open = false;
  }

  $('#productModal').showModal();
}

async function compressImageFile(file) {
  const bitmap = await createImageBitmap(file);
  const encode = (canvas, type, q) => new Promise((res) => canvas.toBlob((b) => res(b), type, q));
  let best = null;

  for (const side of [1100, 900, 720]) {
    const ratio = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const q of [0.82, 0.7, 0.55]) {
      let blob = await encode(canvas, 'image/webp', q);
      if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', q);
      if (!blob) continue;
      best = blob;
      if (blob.size <= 800 * 1024) { bitmap.close?.(); return blob; }
    }
  }
  bitmap.close?.();
  if (!best) throw new Error('No se pudo procesar la imagen.');
  return best;
}

/* ---------- Eventos de Login, Registro y Recuperación ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').hidden = true;
  $('#loginBtn').disabled = true;
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#loginEmail')?.value.trim() || '',
        password: $('#loginPassword').value
      })
    });
    $('#loginPassword').value = '';
    await showApp();
  } catch (err) {
    $('#loginError').textContent = err.message;
    $('#loginError').hidden = false;
  } finally {
    $('#loginBtn').disabled = false;
  }
});

$('#registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#registerError').hidden = true;
  $('#registerMsg').hidden = true;
  $('#registerBtn').disabled = true;
  try {
    const res = await api('/api/seller/register', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#regName').value.trim(),
        city: $('#regCity')?.value.trim() || '',
        phone: $('#regPhone').value.trim(),
        email: $('#regEmail').value.trim(),
        password: $('#regPassword').value
      })
    });
    $('#registerForm').reset();
    if (res.autoLoggedIn) {
      await showApp();
      return;
    }
    $('#registerMsg').textContent = res.message || '¡Cuenta creada! Ya podés iniciar sesión.';
    $('#registerMsg').hidden = false;
  } catch (err) {
    $('#registerError').textContent = err.message;
    $('#registerError').hidden = false;
  } finally {
    $('#registerBtn').disabled = false;
  }
});

$('#forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#forgotError').hidden = true;
  $('#forgotMsg').hidden = true;
  $('#forgotBtn').disabled = true;
  try {
    const res = await api('/api/seller/recover', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#forgotEmail').value.trim(),
        phone: $('#forgotPhone').value.trim(),
        password: $('#forgotPassword').value
      })
    });
    $('#forgotForm').reset();
    $('#forgotMsg').textContent = res.message || 'Contraseña actualizada. Ya podés ingresar.';
    $('#forgotMsg').hidden = false;
  } catch (err) {
    $('#forgotError').textContent = err.message;
    $('#forgotError').hidden = false;
  } finally {
    $('#forgotBtn').disabled = false;
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
  showLogin();
});

$('#newProductBtn').addEventListener('click', () => openProductModal(null));
$('#closeModalBtn').addEventListener('click', () => $('#productModal').close());

$('#prodImageFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) {
    state.selectedFile = null;
    renderMainPreview();
    return;
  }
  try {
    state.selectedFile = await compressImageFile(file);
    $('#productFormError').hidden = true;
  } catch (err) {
    state.selectedFile = null;
    $('#prodImageFile').value = '';
    $('#productFormError').textContent = err.message || 'No se pudo leer la foto. Probá con otra.';
    $('#productFormError').hidden = false;
  }
  renderMainPreview();
});

$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#productFormError').hidden = true;
  $('#saveProductBtn').disabled = true;

  try {
    const idVal = Number($('#prodId').value);

    const price = digitsToInt($('#prodPrice').value);
    if (!(price > 0)) throw new Error('Ingresá el precio del producto.');

    const offerPrice = digitsToInt($('#prodOfferPrice').value);
    let offerEnds = null;

    if (offerPrice > 0) {
      if (offerPrice >= price) throw new Error('El precio de oferta debe ser menor al precio normal.');
      const endsVal = $('#prodOfferEnds').value;
      if (!endsVal) throw new Error('Indicá hasta cuándo vale la oferta (dentro del Paso 4 Oferta).');
      offerEnds = Math.floor(new Date(endsVal).getTime() / 1000);
      if (!(offerEnds > nowSec())) throw new Error('La fecha de fin de la oferta debe ser futura.');
    }

    const tagIds = Array.from($('#prodTags').querySelectorAll('input[type="checkbox"]:checked'))
      .map((cb) => Number(cb.value));

    const colors = productVariants
      .map((v) => ({
        name: String(v.name || '').trim(),
        image_id: v.image_id ? Number(v.image_id) : null,
        image_url: v.image_id ? `/api/image/${v.image_id}` : null
      }))
      .filter((v) => v.name);

    const cityVal = String($('#prodCity')?.value || '').trim().slice(0, 80);
    const shortDetailVal = String($('#prodShortDetail')?.value || '').trim().slice(0, 90);
    const sellerIdVal = isSellerSession()
      ? Number(state.data?.session?.sellerId)
      : ($('#prodSeller')?.value ? Number($('#prodSeller').value) : null);

    const baseAttrs = state.editingProduct?.attributes && typeof state.editingProduct.attributes === 'object'
      ? { ...state.editingProduct.attributes }
      : {};
    const nextAttrs = {
      ...baseAttrs,
      colors,
      ...(cityVal ? { city: cityVal } : {}),
      ...(shortDetailVal ? { short_detail: shortDetailVal } : {}),
      ...(sellerIdVal ? { seller_id: sellerIdVal } : {})
    };
    if (!cityVal) delete nextAttrs.city;
    if (!shortDetailVal) delete nextAttrs.short_detail;
    if (!sellerIdVal) delete nextAttrs.seller_id;

    let targetId = idVal;

    if (!targetId) {
      const tempPayload = {
        name: $('#prodName').value.trim(),
        price_gs: price,
        offer_price_gs: offerPrice,
        offer_ends_at: offerEnds,
        category_id: $('#prodCategory').value ? Number($('#prodCategory').value) : null,
        status: $('#prodStatus').value,
        seller_id: sellerIdVal,
        city: cityVal,
        attributes: nextAttrs,
        description: $('#prodDesc').value.trim(),
        tag_ids: tagIds,
        colors: JSON.stringify(colors)
      };
      const created = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(tempPayload) });
      targetId = created.id;
      $('#prodId').value = String(targetId);
      $('#deleteProductBtn').hidden = false;
    }

    if (state.selectedFile && targetId) {
      const fd = new FormData();
      fd.append('product_id', String(targetId));
      fd.append('file', state.selectedFile, 'photo');
      try {
        const resImg = await api('/api/admin/image', { method: 'POST', body: fd });
        if (resImg && resImg.id) {
          mainPhotoId = Number(resImg.id);
        }
      } catch (imgErr) {
        await refreshBootstrap();
        throw new Error(`El producto se guardó, pero la foto principal no se pudo subir: ${imgErr.message}.`);
      }
    }

    const finalGalleryIds = [];
    for (const item of galleryItems) {
      if (item.type === 'saved' && item.id) {
        finalGalleryIds.push(Number(item.id));
      } else if (item.type === 'pending' && item.blob && targetId) {
        const fd = new FormData();
        fd.append('product_id', String(targetId));
        fd.append('file', item.blob, 'gallery-photo');
        const resGal = await api('/api/admin/image', { method: 'POST', body: fd });
        if (resGal && resGal.id) {
          finalGalleryIds.push(Number(resGal.id));
        }
      }
    }

    const finalImageIds = [];
    if (mainPhotoId) finalImageIds.push(Number(mainPhotoId));
    for (const galId of finalGalleryIds) {
      if (galId && galId !== Number(mainPhotoId)) finalImageIds.push(Number(galId));
    }

    const payload = {
      id: targetId,
      name: $('#prodName').value.trim(),
      price_gs: price,
      offer_price_gs: offerPrice,
      offer_ends_at: offerEnds,
      category_id: $('#prodCategory').value ? Number($('#prodCategory').value) : null,
      status: $('#prodStatus').value,
      seller_id: sellerIdVal,
      city: cityVal,
      attributes: nextAttrs,
      description: $('#prodDesc').value.trim(),
      tag_ids: tagIds,
      image_ids: finalImageIds,
      colors: JSON.stringify(colors)
    };

    await api('/api/admin/products', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    state.selectedFile = null;
    clearPendingGalleryUrls();
    galleryItems = [];
    $('#prodImageFile').value = '';
    $('#productModal').close();
    await refreshBootstrap();
  } catch (err) {
    $('#productFormError').textContent = err.message;
    $('#productFormError').hidden = false;
  } finally {
    $('#saveProductBtn').disabled = false;
  }
});

$('#deleteProductBtn').addEventListener('click', async () => {
  const idVal = Number($('#prodId').value);
  if (!idVal) return;
  if (!confirm('¿Eliminar este producto del catálogo?')) return;

  try {
    await api(`/api/admin/products?id=${idVal}`, { method: 'DELETE' });
    $('#productModal').close();
    await refreshBootstrap();
  } catch (err) {
    $('#productFormError').textContent = err.message;
    $('#productFormError').hidden = false;
  }
});

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'sellers' && isSellerSession()) return;
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
  });
});

(async function init() {
  try {
    await showApp();
  } catch (err) {
    showLogin(err.status === 401 ? '' : 'No se pudo conectar con el servidor. Revisá tu conexión.');
  }
})();