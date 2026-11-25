const state = { data: null, selectedFile: null, editingProduct: null };

// Marca de tiempo dinámica para evitar problemas de caché en navegadores
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

function showLogin(msg = '') {
  $('#adminApp').hidden = true;
  $('#loginView').hidden = false;
  $('#loginError').textContent = msg;
  $('#loginError').hidden = !msg;
}

async function showApp() {
  await refreshBootstrap();
  $('#loginView').hidden = true;
  $('#adminApp').hidden = false;
}

async function refreshBootstrap() {
  state.data = await api('/api/admin/bootstrap');
  setupAdminSearchAndSort(state.data?.products || []);
  populateFormOptions();
  setupLeadsControls();
  renderLeads();
  setupPriceFormatter();
}

/* ---------- Productos, buscador y orden ---------- */
let adminProducts = [];
let adminTerm = '';
let adminSort = { key: null, asc: true };

function visibleProducts() {
  let list = [...adminProducts];
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
    list.innerHTML = '<p class="muted">No se encontraron productos.</p>';
    return;
  }

  const sellers = state.data?.sellers || [];

  list.innerHTML = products.map((p) => {
    const firstImgId = p.image_ids?.[0];
    const imgSrc = firstImgId ? imgUrl(firstImgId) : '';
    const active = offerActive(p);
    const isActive = p.status === 'active';
    const cityLabel = p.attributes?.city ? String(p.attributes.city).trim() : '';
    const sellerId = p.attributes?.seller_id ? Number(p.attributes.seller_id) : null;
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
    if (leadFilters.status && l.status !== leadFilters.status) return false;

    if (leadFilters.seller === '__none__') {
      if (String(l.seller_name || '').trim() !== '') return false;
    } else if (leadFilters.seller) {
      if (String(l.seller_name || '').trim() !== leadFilters.seller) return false;
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

/* ---------- Formulario de producto ---------- */
function populateFormOptions() {
  const cats = state.data?.categories || [];
  $('#prodCategory').innerHTML = `<option value="">Sin categoría</option>` +
    cats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const tags = state.data?.tags || [];
  $('#prodTags').innerHTML = tags.map((t) => `
    <label class="chip-check">
      <input type="checkbox" value="${t.id}" />
      <span>${escapeHtml(t.label)}</span>
    </label>
  `).join('');

  const sellerSelect = $('#prodSeller');
  if (sellerSelect) {
    const sellers = state.data?.sellers || [];
    sellerSelect.innerHTML = `<option value="">Administrador (por defecto)</option>` +
      sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}${s.city ? ' — ' + escapeHtml(s.city) : ''}</option>`).join('');

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
}

/* ============================================================
   ESTADO DE IMÁGENES ESTRICTAMENTE SEPARADO
- mainPhotoId: ID único de la foto principal (independiente)
- galleryImagesList: Array de IDs exclusivo para la galería
   ============================================================ */
let productVariants = [];
let mainPhotoId = null;
let galleryImagesList = [];
let mainPreviewUrl = null;

function syncVariantsWithImages() {
  const validIds = new Set();
  if (mainPhotoId) validIds.add(Number(mainPhotoId));
  for (const id of galleryImagesList) {
    if (id) validIds.add(Number(id));
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

/* --- Foto principal (TOTALMENTE AISLADA) --- */
function renderMainPreview() {
  const box = $('#prodImagePreview');
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
    note = 'Foto nueva pendiente de guardar.';
  } else if (mainPhotoId) {
    src = imgUrl(mainPhotoId);
  }

  if (!src) {
    box.innerHTML = '<p class="muted" style="font-size:12px;">Sin foto principal seleccionada.</p>';
    return;
  }

  box.innerHTML = `
    <div style="position:relative; display:inline-block; border:1px solid #cbd5e1; border-radius:8px; padding:4px; background:#fff;">
      <img src="${src}" alt="Foto principal" style="width:90px; height:90px; object-fit:cover; border-radius:6px; display:block;" />
      <button type="button" id="removeMainPhotoBtn" aria-label="Quitar foto principal" style="position:absolute; top:2px; right:2px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:22px; height:22px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.25);">✕</button>
    </div>
    ${note ? `<small class="muted" style="display:block; margin-top:4px;">${note}</small>` : ''}
  `;
  $('#removeMainPhotoBtn').addEventListener('click', removeMainPhoto);
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

/* --- Galería adicional independiente (Foto #1, #2...) --- */
function renderGallery() {
  const container = $('#productImagesGallery');
  if (!container) return;

  if (!galleryImagesList.length) {
    container.innerHTML = '<p class="muted" style="font-size:12px;">No hay fotos adicionales en la galería.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:8px;" id="dragGalleryContainer">
      ${galleryImagesList.map((id, idx) => `
        <div draggable="true" data-index="${idx}" class="draggable-thumb" style="position:relative; width:85px; height:95px; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; background:#f8fafc; padding:4px; text-align:center; cursor:grab; display:flex; flex-direction:column; justify-content:space-between; align-items:center;">
          <button type="button" onclick="deleteGalleryImage(${id})" aria-label="Eliminar foto" style="position:absolute; top:4px; right:4px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.2);">✕</button>
          <img src="${imgUrl(id)}" alt="" style="width:100%; height:65px; object-fit:cover; border-radius:4px; pointer-events:none;" />
          <span style="font-size:11px; color:#475569; font-weight:600;">Foto #${idx + 1}</span>
        </div>
      `).join('')}
    </div>
    <small class="muted" style="display:block; margin-top:8px;">💡 Arrastrá las fotos adicionales para reordenarlas.</small>
  `;
  setupDragAndDrop();
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
        const moved = galleryImagesList.splice(draggedIndex, 1)[0];
        galleryImagesList.splice(targetIndex, 0, moved);
        draggedIndex = null;
        renderImagesSection();
      }
    });
  });
}

window.deleteGalleryImage = async function (imageId) {
  if (!confirm('¿Eliminar esta foto de la galería?')) return;
  try {
    await api(`/api/admin/image?id=${imageId}`, { method: 'DELETE' });
  } catch (err) {
    alert(err.message);
    return;
  }

  galleryImagesList = galleryImagesList.filter((id) => Number(id) !== Number(imageId));
  syncVariantsWithImages();
  renderImagesSection();
};

const addMoreImagesBtn = $('#addMoreImagesBtn');
if (addMoreImagesBtn && !addMoreImagesBtn.dataset.listener) {
  addMoreImagesBtn.dataset.listener = 'true';
  addMoreImagesBtn.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const prodId = Number($('#prodId').value);
    if (!prodId) {
      alert('Primero debés guardar el producto antes de agregarle más fotos.');
      e.target.value = '';
      return;
    }

    for (const file of files) {
      try {
        const compressed = await compressImageFile(file);
        const fd = new FormData();
        fd.append('product_id', String(prodId));
        fd.append('file', compressed, 'photo');
        const res = await api('/api/admin/image', { method: 'POST', body: fd });
        if (res && res.id) {
          galleryImagesList.push(res.id);
        }
      } catch (err) {
        alert(`No se pudo subir una de las fotos: ${err.message}`);
      }
    }

    e.target.value = '';
    syncVariantsWithImages();
    renderImagesSection();
  });
}

/* --- Variantes de Color --- */
function renderVariantsForm(variants = productVariants) {
  productVariants = variants;
  const container = $('#productVariantsList');
  if (!container) return;

  if (!variants.length) {
    container.innerHTML = '<p class="muted" style="font-size:12px;">Sin variantes de color añadidas.</p>';
    return;
  }

  container.innerHTML = variants.map((v, index) => `
    <div style="display:flex; gap:6px; align-items:center; background:#f8fafc; padding:8px; border-radius:8px; border:1px solid #e2e8f0; flex-wrap:wrap;">
      <input type="text" value="${escapeHtml(v.name || '')}" placeholder="Ej: Marrón, Rosa..." data-variant-name="${index}" style="flex:1; min-width:110px; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px;" />

      <select data-variant-img="${index}" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px; background:#fff;">
        <option value="">📸 Foto por defecto</option>
        ${mainPhotoId ? `<option value="${mainPhotoId}" ${Number(v.image_id) === Number(mainPhotoId) ? 'selected' : ''}>⭐ Foto principal (Portada)</option>` : ''}
        ${galleryImagesList.map((id, gIdx) => `
          <option value="${id}" ${Number(v.image_id) === Number(id) ? 'selected' : ''}>Foto #${gIdx + 1}</option>
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

/* --- Modal de producto --- */
function openProductModal(prod = null) {
  state.editingProduct = prod;
  state.selectedFile = null;
  $('#prodImageFile').value = '';
  $('#productFormError').hidden = true;

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
  galleryImagesList = ids.slice(1);

  renderImagesSection();

  if (prod) {
    $('#productModalTitle').textContent = 'Editar producto';
    $('#prodId').value = prod.id;
    $('#prodName').value = prod.name || '';
    $('#prodPrice').value = dots(prod.price_gs);
    $('#prodOfferPrice').value = offerActive(prod) ? prod.offer_price_gs : '';
    $('#prodOfferEnds').value = offerActive(prod) ? toLocalInput(prod.offer_ends_at) : '';
    $('#prodCategory').value = prod.category_id || '';
    $('#prodStatus').value = prod.status || 'active';
    const sellerSelect = $('#prodSeller');
    if (sellerSelect) sellerSelect.value = prod.attributes?.seller_id ? String(prod.attributes.seller_id) : '';
    const cityInput = $('#prodCity');
    if (cityInput) cityInput.value = prod.attributes?.city || '';
    $('#prodDesc').value = prod.description || '';
    $('#deleteProductBtn').hidden = false;

    const selectedTags = new Set(prod.tag_ids || []);
    $('#prodTags').querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = selectedTags.has(Number(cb.value));
    });
  } else {
    $('#productModalTitle').textContent = 'Nuevo producto';
    $('#productForm').reset();
    $('#prodId').value = '';
    $('#prodStatus').value = 'active';
    const sellerSelect = $('#prodSeller');
    if (sellerSelect) sellerSelect.value = '';
    const cityInput = $('#prodCity');
    if (cityInput) cityInput.value = '';
    mainPhotoId = null;
    galleryImagesList = [];
    productVariants = [];
    renderImagesSection();
    $('#deleteProductBtn').hidden = true;
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

/* ---------- Eventos ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').hidden = true;
  $('#loginBtn').disabled = true;
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: $('#loginPassword').value })
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

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
  state.data = null;
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

/* ---------- SUBMIT ATÓMICO BLINDADO ---------- */
$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#productFormError').hidden = true;
  $('#saveProductBtn').disabled = true;

  try {
    const idVal = Number($('#prodId').value);

    const price = digitsToInt($('#prodPrice').value);
    if (!(price > 0)) throw new Error('Ingresá el precio normal.');

    const offerPrice = digitsToInt($('#prodOfferPrice').value);
    let offerEnds = null;

    if (offerPrice > 0) {
      if (offerPrice >= price) throw new Error('El precio de oferta debe ser menor al precio normal.');
      const endsVal = $('#prodOfferEnds').value;
      if (!endsVal) throw new Error('Indicá hasta cuándo vale la oferta.');
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
    const sellerIdVal = $('#prodSeller')?.value ? Number($('#prodSeller').value) : null;

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

    const finalImageIds = [];
    if (mainPhotoId) finalImageIds.push(Number(mainPhotoId));
    for (const galId of galleryImagesList) {
      if (galId) finalImageIds.push(Number(galId));
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
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
  });
});

// Arranque
(async function init() {
  try {
    await showApp();
  } catch (err) {
    showLogin(err.status === 401 ? '' : 'No se pudo conectar con el servidor. Revisá tu conexión.');
  }
})();