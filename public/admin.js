const state = { data: null, selectedFile: null, editingProduct: null };

const $ = (sel) => document.querySelector(sel);
const fmtGs = (n) => new Intl.NumberFormat('es-PY').format(Number(n || 0)) + ' Gs.';
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
  renderProducts(state.data?.products || []);
  setupAdminSearchAndSort(state.data?.products || []);
  renderLeads();
  populateFormOptions();
  setupPriceFormatter();
}

/* ---------- Productos y Buscador ---------- */
function renderProducts(products = []) {
  const list = $('#productsList');
  if (!products.length) {
    list.innerHTML = '<p class="muted">No se encontraron productos.</p>';
    return;
  }

  list.innerHTML = products.map((p) => {
    const firstImgId = p.image_ids?.[0];
    const imgSrc = firstImgId ? `/api/image/${firstImgId}` : '';
    const active = offerActive(p);
    const isActive = p.status === 'active';
    return `
      <article class="card">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${escapeHtml(p.name)}" class="card-thumb" loading="lazy" />`
          : `<div class="card-thumb"></div>`}
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            <span class="pill ${isActive ? 'pill-ok' : 'pill-warn'}">${isActive ? 'Activo' : 'Pausado'}</span>
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

function setupAdminSearchAndSort(productsArray) {
  const searchInput = $('#searchInput');
  const sortByNameBtn = $('#sortByName');
  const sortByPriceBtn = $('#sortByPrice');

  if (!searchInput) return;

  let currentProducts = [...productsArray];

  // Evitar duplicar eventos si ya se asignaron
  if (!searchInput.dataset.initialized) {
    searchInput.dataset.initialized = "true";

    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = currentProducts.filter(p => p.name.toLowerCase().includes(term));
      renderProducts(filtered);
    });

    let ascName = true;
    if (sortByNameBtn) {
      sortByNameBtn.addEventListener('click', () => {
        currentProducts.sort((a, b) => ascName ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        ascName = !ascName;
        renderProducts(currentProducts);
      });
    }

    let ascPrice = true;
    if (sortByPriceBtn) {
      sortByPriceBtn.addEventListener('click', () => {
        currentProducts.sort((a, b) => ascPrice ? a.price_gs - b.price_gs : b.price_gs - a.price_gs);
        ascPrice = !ascPrice;
        renderProducts(currentProducts);
      });
    }
  }
}

/* ---------- Formateador de Precio con Miles ---------- */
function setupPriceFormatter() {
  const priceInput = $('#prodPrice');
  if (!priceInput || priceInput.dataset.formatted) return;
  priceInput.dataset.formatted = "true";

  priceInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value) {
      e.target.value = Number(value).toLocaleString('es-PY');
    } else {
      e.target.value = '';
    }
  });
}

/* ---------- Pedidos ---------- */
const LEAD_LABELS = { new: 'Nuevo', chatting: 'Conversando', sold: 'Vendido', lost: 'Perdido' };

function renderLeads() {
  const list = $('#leadsList');
  const leads = state.data?.leads || [];
  if (!leads.length) {
    list.innerHTML = '<p class="muted">No hay pedidos registrados todavía.</p>';
    return;
  }

  list.innerHTML = leads.map((l) => {
    const itemsText = (l.items || [])
      .map((it) => `${it.qty}x ${it.product_name} (${fmtGs(it.unit_price_gs)})`)
      .join(' · ');
    const wa = waLink(l.customer_phone);

    return `
      <article class="card">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong>Ref ${escapeHtml(l.ref || ('#' + l.id))}</strong>
            <select data-lead-status="${l.id}" style="padding:5px 8px;border-radius:8px;border:1px solid #d0d5dd;">
              ${Object.entries(LEAD_LABELS).map(([val, label]) =>
                `<option value="${val}" ${l.status === val ? 'selected' : ''}>${label}</option>`
              ).join('')}
            </select>
          </div>
          <p class="muted" style="margin:4px 0 2px;">${l.created_at ? new Date(l.created_at * 1000).toLocaleString('es-PY') : ''}</p>
          <p style="margin:6px 0 2px;"><strong>${escapeHtml(l.customer_name || 'Cliente')}</strong>${l.customer_phone ? ' · ' + escapeHtml(l.customer_phone) : ''}</p>
          ${l.seller_name ? `<p class="muted" style="margin:0 0 4px;">Vendedor: ${escapeHtml(l.seller_name)}</p>` : ''}
          ${itemsText ? `<p class="muted" style="margin:0 0 4px;">${escapeHtml(itemsText)}</p>` : ''}
          ${l.note ? `<p class="muted" style="margin:0;">Nota: ${escapeHtml(l.note)}</p>` : ''}
          ${wa ? `<p style="margin:8px 0 0;"><a class="btn btn-ghost btn-sm" href="${wa}" target="_blank" rel="noopener">Escribir por WhatsApp</a></p>` : ''}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-lead-status]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await api('/api/admin/leads', {
          method: 'PUT',
          body: JSON.stringify({ id: Number(sel.dataset.leadStatus), status: sel.value })
        });
      } catch (err) {
        alert(err.message);
        await refreshBootstrap();
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
}

let productVariants = [];
let productImagesList = [];

function renderVariantsForm(variants = []) {
  productVariants = variants;
  const container = $('#productVariantsList');
  if (!container) return;

  if (!variants.length) {
    container.innerHTML = '<p class="muted" style="font-size:12px;">Sin variantes de color añadidas.</p>';
    return;
  }

  const availableImages = productImagesList || [];

  container.innerHTML = variants.map((v, index) => `
    <div style="display:flex; gap:6px; align-items:center; background:#f8fafc; padding:8px; border-radius:8px; border:1px solid #e2e8f0; flex-wrap:wrap;">
      <input type="text" value="${escapeHtml(v.name || '')}" placeholder="Ej: Marrón, Rosa..." data-variant-name="${index}" style="flex:1; min-width:110px; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1; font-size:13px;" />
      
      <select data-variant-img="${index}" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px; background:#fff;">
        <option value="">📸 Foto por defecto</option>
        ${availableImages.map((img, imgIdx) => `
          <option value="${img.id}" ${Number(v.image_id) === Number(img.id) ? 'selected' : ''}>Foto #${imgIdx + 1}</option>
        `).join('')}
      </select>

      <button type="button" class="btn btn-danger btn-sm" onclick="removeVariant(${index})" style="padding:4px 8px;">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-variant-name]').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.variantName);
      if (productVariants[idx]) productVariants[idx].name = e.target.value.trim();
    });
  });

  container.querySelectorAll('[data-variant-img]').forEach(select => {
    select.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.variantImg);
      if (productVariants[idx]) {
        productVariants[idx].image_id = e.target.value ? Number(e.target.value) : null;
      }
    });
  });
}

window.removeVariant = function(index) {
  productVariants.splice(index, 1);
  renderVariantsForm(productVariants);
};

const addVariantBtn = $('#addVariantBtn');
if (addVariantBtn && !addVariantBtn.dataset.listener) {
  addVariantBtn.dataset.listener = "true";
  addVariantBtn.addEventListener('click', () => {
    productVariants.push({ name: '' });
    renderVariantsForm(productVariants);
  });
}

// Galería de fotos con reordenamiento y eliminación
// function renderProductImagesGallery(images = []) {
//   productImagesList = images;
//   const container = $('#productImagesGallery');
//   if (!container) return;

//   if (!images.length) {
//     container.innerHTML = '<p class="muted" style="font-size:12px;">No hay fotos cargadas todavía.</p>';
//     renderVariantsForm(productVariants);
//     return;
//   }

//   container.innerHTML = `
//     <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
//       ${images.map((img, index) => `
//         <div style="position:relative; width:80px; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; background:#f1f5f9; padding:4px; text-align:center;">
//           <img src="/api/image/${img.id}" style="width:100%; height:60px; object-fit:cover; border-radius:4px;" />
//           <button type="button" onclick="deleteProductImage(${img.id})" style="position:absolute; top:2px; right:2px; background:rgba(231,76,60,0.9); color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
//           <div style="display:flex; justify-content:space-between; margin-top:4px;">
//             ${index > 0 ? `<button type="button" onclick="moveGalleryImage(${index}, -1)" style="font-size:10px; cursor:pointer; padding:1px 4px;">◀</button>` : '<span></span>'}
//             ${index < images.length - 1 ? `<button type="button" onclick="moveGalleryImage(${index}, 1)" style="font-size:10px; cursor:pointer; padding:1px 4px;">▶</button>` : '<span></span>'}
//           </div>
//         </div>
//       `).join('')}
//     </div>
//   `;
//   renderVariantsForm(productVariants);
// }

// --- GALERÍA DE FOTOS CON DRAG & DROP Y ELIMINACIÓN ---
function renderProductImagesGallery(images = []) {
  productImagesList = images;
  const container = $('#productImagesGallery');
  if (!container) return;

  if (!images.length) {
    container.innerHTML = '<p class="muted" style="font-size:12px;">No hay fotos cargadas todavía.</p>';
    renderVariantsForm(productVariants);
    return;
  }

  container.innerHTML = `
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;" id="dragGalleryContainer">
      ${images.map((img, index) => `
        <div draggable="true" data-index="${index}" class="draggable-thumb" style="position:relative; width:80px; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; background:#f1f5f9; padding:4px; text-align:center; cursor:grab;">
          <img src="/api/image/${img.id}" style="width:100%; height:60px; object-fit:cover; border-radius:4px; pointer-events:none;" />
          <button type="button" onclick="deleteProductImage(${img.id})" style="position:absolute; top:2px; right:2px; background:rgba(231,76,60,0.9); color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
          <div style="font-size:10px; color:#64748b; margin-top:3px;">#${index + 1}</div>
        </div>
      `).join('')}
    </div>
    <small class="muted" style="display:block; margin-top:6px;">💡 Tip: Hacé clic sin soltar en una foto y arrastrala para cambiarla de orden.</small>
  `;

  setupDragAndDrop();
  renderVariantsForm(productVariants);
}

// Configurar eventos de Arrastrar y Soltar con el Mouse
function setupDragAndDrop() {
  const container = $('#dragGalleryContainer');
  if (!container) return;

  let draggedIndex = null;

  container.querySelectorAll('.draggable-thumb').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      draggedIndex = Number(e.target.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetItem = e.target.closest('.draggable-thumb');
      if (!targetItem) return;
      const targetIndex = Number(targetItem.dataset.index);

      if (draggedIndex !== null && draggedIndex !== targetIndex) {
        // Reordenar el array localmente
        const movedItem = productImagesList.splice(draggedIndex, 1)[0];
        productImagesList.splice(targetIndex, 0, movedItem);
        
        // Re-renderizar con el nuevo orden
        renderProductImagesGallery(productImagesList);
      }
    });
  });
}

window.deleteProductImage = async function(imageId) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api(`/api/admin/image?id=${imageId}`, { method: 'DELETE' });
    productImagesList = productImagesList.filter(img => img.id !== imageId);
    renderProductImagesGallery(productImagesList);
    if (state.editingProduct) {
      state.editingProduct.image_ids = productImagesList.map(i => i.id);
      renderProducts(state.data.products);
    }
  } catch (err) {
    alert(err.message);
  }
};

window.moveGalleryImage = function(index, direction) {
  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < productImagesList.length) {
    const temp = productImagesList[index];
    productImagesList[index] = productImagesList[newIndex];
    productImagesList[newIndex] = temp;
    renderProductImagesGallery(productImagesList);
  }
};

window.deleteProductImage = async function(imageId) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api(`/api/admin/image?id=${imageId}`, { method: 'DELETE' });
    productImagesList = productImagesList.filter(img => img.id !== imageId);
    renderProductImagesGallery(productImagesList);
    if (state.editingProduct) {
      state.editingProduct.image_ids = productImagesList.map(i => i.id);
      renderProducts(state.data.products);
    }
  } catch (err) {
    alert(err.message);
  }
};

const addMoreImagesBtn = $('#addMoreImagesBtn');
if (addMoreImagesBtn && !addMoreImagesBtn.dataset.listener) {
  addMoreImagesBtn.dataset.listener = "true";
  addMoreImagesBtn.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    const prodId = Number($('#prodId').value);
    if (!prodId) {
      alert('Primero debés guardar el producto antes de agregarle múltiples fotos.');
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
          productImagesList.push({ id: res.id });
        }
      } catch (err) {
        alert(`No se pudo subir una de las fotos: ${err.message}`);
      }
    }

    e.target.value = '';
    renderProductImagesGallery(productImagesList);
    await refreshBootstrap();
  });
}

function openProductModal(prod = null) {
  state.editingProduct = prod;
  state.selectedFile = null;
  $('#prodImageFile').value = '';
  $('#productFormError').hidden = true;

  try {
    const parsedVariants = prod && prod.colors ? (typeof prod.colors === 'string' ? JSON.parse(prod.colors) : prod.colors) : [];
    renderVariantsForm(parsedVariants.map(v => ({ name: (v.name || v).trim(), image_id: v.image_id || null })));
  } catch {
    renderVariantsForm([]);
  }

  const prodImages = prod && prod.images ? prod.images : (prod && prod.image_ids ? prod.image_ids.map(id => ({ id })) : []);
  renderProductImagesGallery(prodImages);

  if (prod) {
    $('#productModalTitle').textContent = 'Editar producto';
    $('#prodId').value = prod.id;
    $('#prodName').value = prod.name || '';
    $('#prodPrice').value = fmtGs(prod.price_gs).replace(' Gs.', '');
    $('#prodOfferPrice').value = offerActive(prod) ? prod.offer_price_gs : '';
    $('#prodOfferEnds').value = offerActive(prod) ? toLocalInput(prod.offer_ends_at) : '';
    $('#prodCategory').value = prod.category_id || '';
    $('#prodStatus').value = prod.status || 'active';
    $('#prodDesc').value = prod.description || '';
    $('#deleteProductBtn').hidden = false;

    const selectedTags = new Set(prod.tag_ids || []);
    $('#prodTags').querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = selectedTags.has(Number(cb.value));
    });

    $('#prodImagePreview').innerHTML = prod.image_ids?.[0]
      ? `<img src="/api/image/${prod.image_ids[0]}" alt="Vista previa" />`
      : '';
  } else {
    $('#productModalTitle').textContent = 'Nuevo producto';
    $('#productForm').reset();
    $('#prodId').value = '';
    $('#prodStatus').value = 'active';
    $('#deleteProductBtn').hidden = true;
    $('#prodImagePreview').innerHTML = '';
    renderProductImagesGallery([]);
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
  if (!file) { state.selectedFile = null; return; }
  try {
    const compressed = await compressImageFile(file);
    state.selectedFile = compressed;
    $('#prodImagePreview').innerHTML = `<img src="${URL.createObjectURL(compressed)}" alt="Vista previa" />`;
    $('#productFormError').hidden = true;
  } catch (err) {
    state.selectedFile = null;
    $('#prodImageFile').value = '';
    $('#productFormError').textContent = err.message || 'No se pudo leer la foto. Probá con otra.';
    $('#productFormError').hidden = false;
  }
});

$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#productFormError').hidden = true;
  $('#saveProductBtn').disabled = true;

  try {
    const idVal = Number($('#prodId').value);
    const rawPrice = $('#prodPrice').value.replace(/\./g, '').replace(/\D/g, '');
    const price = Number(rawPrice);
    const offerPrice = Number($('#prodOfferPrice').value) || 0;
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

    const payload = {
      ...(idVal ? { id: idVal } : {}),
      name: $('#prodName').value.trim(),
      price_gs: price,
      offer_price_gs: offerPrice,
      offer_ends_at: offerEnds,
      category_id: $('#prodCategory').value ? Number($('#prodCategory').value) : null,
      status: $('#prodStatus').value,
      description: $('#prodDesc').value.trim(),
      tag_ids: tagIds,
      colors: JSON.stringify(productVariants.map(v => ({ name: (v.name || '').trim(), image_id: v.image_id || null })))
    };

    const saved = await api('/api/admin/products', {
      method: idVal ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });

    const targetId = idVal || saved.id;
    if (!idVal) { $('#prodId').value = String(saved.id); $('#deleteProductBtn').hidden = false; }

    if (state.selectedFile && targetId) {
      const fd = new FormData();
      fd.append('product_id', String(targetId));
      fd.append('file', state.selectedFile, 'photo');
      try {
        await api('/api/admin/image', { method: 'POST', body: fd });
      } catch (imgErr) {
        await refreshBootstrap();
        throw new Error(`El producto se guardó, pero la foto principal no se pudo subir: ${imgErr.message}. Volvé a presionar Guardar para reintentar.`);
      }
    }

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