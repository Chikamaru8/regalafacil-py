const BRAND_NAME = "Regalafacil PY";
let appData = { settings: {}, seller: null, sellers: [], cities: [], categories: [], tags: [], products: [] };
let state = { search: "", categoryId: "", maxBudget: 0, city: "", sort: "featured", giftContext: null };
let selectedColor = "";
let currentProduct = null;
let pendingRef = "";
let currentActiveImageId = null; // Controla la foto activa mostrada en el modal

const formatGs = amount => "Gs. " + Number(amount || 0).toLocaleString('es-PY');
const IMG_VER = Date.now();

function normalizePhone(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = "595" + d.slice(1);
  return d;
}

const getPhone = () =>
  normalizePhone(appData.seller?.phone || appData.settings.business?.default_phone || "595994354894");

function getProductSeller(product) {
  const sellerId = product?.seller_id || product?.attributes?.seller_id;
  if (sellerId) {
    const found = (appData.sellers || []).find(s => Number(s.id) === Number(sellerId));
    if (found) return found;
  }
  return appData.seller || null;
}

function getProductPhone(product) {
  const owner = getProductSeller(product);
  return normalizePhone(owner?.phone || appData.settings.business?.default_phone || "595994354894");
}

// ---------- Almacenamiento local seguro ----------
const ls = {
  get(k, d) {
    try {
      const v = localStorage.getItem('rf_' + k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('rf_' + k, JSON.stringify(v));
    } catch {}
  }
};

// Vendedor por enlace (?v=slug), guardado 30 dias (respaldo si el producto no tiene dueño asignado)
let vslug = new URLSearchParams(location.search).get('v');
if (vslug) {
  ls.set('seller', { slug: vslug, t: Date.now() });
} else {
  const s = ls.get('seller', null);
  if (s && Date.now() - s.t < 30 * 864e5) vslug = s.slug;
}

// Identificador anonimo del visitante
function getVisitorId() {
  let v = ls.get('visitor', '');
  if (!v) {
    const r = crypto.getRandomValues(new Uint8Array(12));
    v = Array.from(r, x => x.toString(16).padStart(2, '0')).join('');
    ls.set('visitor', v);
  }
  return v;
}

function generateRef() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(r, x => chars[x % chars.length]).join('');
}

// ---------- Colores ----------
function getColorObjects(p) {
  const raw = p?.attributes?.colors;
  if (!Array.isArray(raw)) return [];
  return raw.map(c => {
    if (typeof c === 'object' && c !== null) {
      return { name: String(c.name || '').trim(), image_id: c.image_id || null };
    }
    return { name: String(c || '').trim(), image_id: null };
  }).filter(c => c.name);
}

// ---------- WhatsApp y registro del pedido ----------
function buildWhatsAppUrl(product, price, ref) {
  const owner = getProductSeller(product);
  const sellerName = owner?.name ? ` (${owner.name})` : "";
  const productUrl = window.location.origin + window.location.pathname + `?p=${product.id}`;
  const colors = getColorObjects(product);

  let message = `¡Hola${sellerName}! Me interesa este producto de *${BRAND_NAME}*:\n\n`;
  message += `🔍 Ref: *#${ref}*\n`;
  message += `🛍️ Producto: *${product.name}*\n`;
  message += `💰 Precio: *${formatGs(price)}*\n`;

  if (product.description && String(product.description).trim()) {
    message += `📝 Detalle: ${String(product.description).trim()}\n`;
  }

  if (selectedColor) {
    message += `🎨 Variante elegida: *${selectedColor}*\n`;
  } else if (colors.length === 1) {
    message += `🎨 Variante disponible: *${colors[0].name}*\n`;
  } else if (colors.length > 1) {
    message += `🎨 Opciones disponibles: *${colors.map(c => c.name).join(", ")}* (indicar cuál preferís)\n`;
  }

  if (state.giftContext) {
    message += `🎁 Ocasión: *${state.giftContext.recipient}* (${state.giftContext.occasion})\n`;
  }

  message += `\n🔗 Ver producto: ${productUrl}\n\n`;
  message += `¿Tienen disponibilidad y cómo coordinamos?`;

  return `https://wa.me/${getProductPhone(product)}?text=${encodeURIComponent(message)}`;
}

// El servidor toma nombre, precio y vendedor de la base: aqui solo van ids y cantidad
function registerLead(ref, product) {
  try {
    const owner = getProductSeller(product);
    fetch('/api/leads', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref,
        seller_slug: owner?.slug || vslug || '',
        visitor_id: getVisitorId(),
        items: [{ product_id: product.id, qty: 1 }]
      })
    }).catch(() => {});
  } catch {}
}

function getEffectivePrice(p) {
  const now = Math.floor(Date.now() / 1000);
  if (p.offer_price_gs != null && (!p.offer_ends_at || p.offer_ends_at > now)) {
    return Number(p.offer_price_gs);
  }
  return Number(p.price_gs || 0);
}

function renderCities() {
  const select = document.getElementById("citySelect");
  if (!select) return;

  const citiesMap = new Map();
  for (const c of appData.cities || []) {
    const clean = String(c || '').trim();
    if (clean) citiesMap.set(clean.toLowerCase(), clean);
  }
  for (const p of appData.products || []) {
    const clean = String(p?.attributes?.city || '').trim();
    if (clean) citiesMap.set(clean.toLowerCase(), clean);
  }

  const cities = Array.from(citiesMap.values()).sort((a, b) => a.localeCompare(b, 'es'));
  select.innerHTML = `<option value="">Ciudad: Todas</option>` +
    cities.map(city => `<option value="${esc(city)}">${esc(city)}</option>`).join("");
  select.value = state.city || "";
}

function handleCityFilter(val) {
  state.city = val;
  renderProducts();
}

async function initCatalog() {
  document.title = BRAND_NAME;
  try {
    const res = await fetch(vslug ? `/api/catalog?v=${encodeURIComponent(vslug)}` : '/api/catalog');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object') {
      appData = { ...appData, ...data };
    }
  } catch (err) {
    console.error("Error conectando al backend D1:", err);
  }

  try {
    const phoneNum = getPhone();
    if (phoneNum) {

      const fabBtn = document.getElementById("fabBtn");
      if (fabBtn) fabBtn.href = `https://wa.me/${phoneNum}?text=${encodeURIComponent('¡Hola! Tengo una consulta sobre ' + BRAND_NAME)}`;
      const consultBtn = document.getElementById("consultStockBtn");
      if (consultBtn) consultBtn.href = `https://wa.me/${phoneNum}?text=${encodeURIComponent('¡Hola! Estuve buscando un regalo en ' + BRAND_NAME + ' pero quiero consultar stock personalizado.')}`;
    }
  } catch (err) {
    console.error("Error configurando contacto:", err);
  }

  try { renderCategories(); } catch (err) { console.error(err); }
  try { renderCities(); } catch (err) { console.error(err); }
  try { renderProducts(); } catch (err) { console.error(err); }

  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  // Abrir automaticamente si viene con parametro ?p=ID
  const urlParams = new URLSearchParams(location.search);
  const prodId = urlParams.get('p');
  if (prodId && Array.isArray(appData.products)) {
    const found = appData.products.find(x => String(x.id) === prodId);
    if (found) openProductModal(found.id);
  }
}

function renderCategories() {
  const container = document.getElementById("categoryFilters");
  if (!container) return;

  // Solo mostrar categorías que tengan al menos un producto disponible
  const activeCatIds = new Set(
    (appData.products || [])
      .map(p => p.category_id)
      .filter(id => id != null && id !== "")
      .map(id => String(id))
  );

  let html = `<button onclick="setCategoryFilter('', this)" class="cat-chip active shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold bg-brand-600 text-white shadow-sm shadow-brand-500/20 flex items-center gap-1.5 transition cursor-pointer"><span>🔥</span> Todo</button>`;

  (appData.categories || [])
    .filter(c => activeCatIds.has(String(c.id)))
    .forEach(c => {
      html += `<button onclick="setCategoryFilter('${c.id}', this)" class="cat-chip shrink-0 px-3.5 py-2 rounded-2xl text-xs font-semibold bg-white text-slate-700 border border-slate-200/90 hover:border-slate-300 flex items-center gap-1.5 transition cursor-pointer"><span>📁</span> ${esc(c.name)}</button>`;
    });

  container.innerHTML = html;
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  const emptyState = document.getElementById("emptyState");
  const countLabel = document.getElementById("productCount");
  const resetMob = document.getElementById("resetHeaderBtnMobile");
  const resetDesk = document.getElementById("resetHeaderBtnDesktop");

  let list = (appData.products || []).filter(p => {
    const matchesSearch = state.search === "" || (p.name + ' ' + (p.description || '')).toLowerCase().includes(state.search);
    const matchesCat = state.categoryId === "" || String(p.category_id) === String(state.categoryId);
    const price = getEffectivePrice(p);
    const matchesBudget = state.maxBudget === 0 || price <= state.maxBudget;
    const prodCity = String(p?.attributes?.city || '').trim().toLowerCase();
    const matchesCity = state.city === "" || prodCity === state.city.toLowerCase();
    return matchesSearch && matchesCat && matchesBudget && matchesCity;
  });

  if (state.sort === "price_asc") {
    list.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
  } else if (state.sort === "price_desc") {
    list.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
  } else if (state.sort === "name_asc") {
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  }

  const hasActiveFilter = state.search !== "" || state.categoryId !== "" || state.maxBudget > 0 || state.city !== "" || state.giftContext !== null;
  if (resetMob) resetMob.classList.toggle("hidden", !hasActiveFilter);
  if (resetDesk) resetDesk.classList.toggle("hidden", !hasActiveFilter);
  if (countLabel) countLabel.textContent = `${list.length} ${list.length === 1 ? 'opción' : 'opciones'}`;

  if (list.length === 0) {
    if (grid) grid.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  if (!grid) return;

  grid.innerHTML = list.map((p, index) => {
    const price = getEffectivePrice(p);
    const hasOffer = p.offer_price_gs != null && price < Number(p.price_gs);
    const imgUrl = p.image_ids && p.image_ids.length ? `/api/image/${p.image_ids[0]}?v=${IMG_VER}` : 'https://placehold.co/400x400/f1f5f9/64748b?text=Sin+Foto';
    const catObj = (appData.categories || []).find(c => c.id === p.category_id);
    const catStr = catObj ? catObj.name : 'General';
    const cityStr = String(p?.attributes?.city || '').trim();
    const badgeText = p.attributes?.badge || (hasOffer ? 'Oferta' : 'Ideal regalo');

    return `
      <article
        onclick="openProductModal(${p.id})"
        style="animation-delay: ${index * 25}ms"
        class="animate-pop bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col cursor-pointer active:scale-[0.98]"
      >
        <div class="relative aspect-square bg-slate-100 overflow-hidden">
          <img src="${imgUrl}" alt="${esc(p.name)}" loading="lazy" class="w-full h-full object-cover hover:scale-105 transition duration-300">
          <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/95 text-slate-800 shadow-xs">
            ${esc(badgeText)}
          </span>
        </div>

        <div class="p-3.5 flex-1 flex flex-col justify-between gap-2">
          <div>
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">${esc(catStr)}${cityStr ? ` · ${esc(cityStr)}` : ''}</span>
            <h4 class="font-display font-bold text-xs sm:text-sm text-slate-800 line-clamp-2 leading-snug mt-0.5">
              ${esc(p.name)}
            </h4>
          </div>

          <div class="pt-1">
            <div class="flex items-baseline gap-1.5">
              <p class="font-display font-extrabold text-sm sm:text-base text-brand-600">${formatGs(price)}</p>
              ${hasOffer ? `<s class="text-[11px] text-slate-400">${formatGs(p.price_gs)}</s>` : ''}
            </div>
            <div class="mt-2 w-full py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1 border border-emerald-200/60 transition">
              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
              <span>Me interesa</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function handleSearch(val) {
  state.search = val.trim().toLowerCase();
  document.getElementById("clearSearchBtn").classList.toggle("hidden", state.search === "");
  renderProducts();
}

function clearSearch() {
  const input = document.getElementById("searchInput");
  input.value = "";
  handleSearch("");
  input.focus();
}

function handleSort(val) {
  state.sort = val;
  renderProducts();
}

function setBudgetFilter(max, btnEl) {
  state.maxBudget = max;
  document.querySelectorAll(".budget-chip").forEach(btn => {
    btn.className = "budget-chip shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:border-slate-300 transition cursor-pointer";
  });
  btnEl.className = "budget-chip active shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white shadow-sm transition cursor-pointer";
  document.getElementById("budgetLabel").textContent = max === 0 ? "Todos los precios" : `Hasta ${formatGs(max)}`;
  renderProducts();
}

function setCategoryFilter(catId, btnEl) {
  state.categoryId = catId;
  document.querySelectorAll(".cat-chip").forEach(btn => {
    btn.className = "cat-chip shrink-0 px-3.5 py-2 rounded-2xl text-xs font-semibold bg-white text-slate-700 border border-slate-200/90 hover:border-slate-300 flex items-center gap-1.5 transition cursor-pointer";
  });
  btnEl.className = "cat-chip active shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold bg-brand-600 text-white shadow-sm shadow-brand-500/20 flex items-center gap-1.5 transition cursor-pointer";
  document.getElementById("catalogTitle").textContent = catId === "" ? "Catálogo" : "Filtrado por categoría";
  renderProducts();
}

function resetAllFilters() {
  state.search = "";
  state.categoryId = "";
  state.maxBudget = 0;
  state.city = "";
  state.sort = "featured";
  state.giftContext = null;

  document.getElementById("searchInput").value = "";
  const cityEl = document.getElementById("citySelect");
  if (cityEl) cityEl.value = "";
  document.getElementById("sortSelect").value = "featured";
  document.getElementById("clearSearchBtn").classList.add("hidden");
  document.getElementById("assistantResultBanner").classList.add("hidden");
  document.getElementById("catalogTitle").textContent = "Catálogo";
  document.getElementById("budgetLabel").textContent = "Todos los precios";

  const firstB = document.querySelector(".budget-chip");
  if (firstB) setBudgetFilter(0, firstB);
  const firstC = document.querySelector(".cat-chip");
  if (firstC) setCategoryFilter("", firstC);
}

function openProductModal(id) {
  const p = (appData.products || []).find(item => item.id === id);
  if (!p) return;

  currentProduct = p;
  pendingRef = generateRef();
  const price = getEffectivePrice(p);

  const images = p.images || (p.image_ids ? p.image_ids.map(imgId => ({ id: imgId })) : []);
  currentActiveImageId = images.length ? images[0].id : null;
  updateModalImageDisplay();

  renderModalThumbnails(images);

  const catObj = (appData.categories || []).find(c => c.id === p.category_id);

  document.getElementById("modalBadge").textContent = p.attributes?.badge || "Ideal regalo";
  document.getElementById("modalCategory").textContent = catObj ? catObj.name : "General";
  document.getElementById("modalTitle").textContent = p.name;
  document.getElementById("modalPrice").textContent = formatGs(price);

  syncSelectedVariantByImage(currentActiveImageId);

  updateModalWhatsappButton();

  const highlights = Array.isArray(p.attributes?.highlights) ? p.attributes.highlights.filter(Boolean) : [];
  let bulletsHtml = "";
  if (highlights.length > 0) {
    bulletsHtml = highlights.map(h => `<li class="flex items-start gap-2"><span class="text-emerald-600 font-bold">✓</span><span>${esc(h)}</span></li>`).join("");
  } else {
    bulletsHtml = `<li class="text-slate-600">${esc(p.description || "Producto de excelente calidad y gran durabilidad.")}</li>`;
  }
  document.getElementById("modalBullets").innerHTML = bulletsHtml;

  document.getElementById("productModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function updateModalImageDisplay() {
  const imgEl = document.getElementById("modalImg");
  if (currentActiveImageId) {
    imgEl.src = `/api/image/${currentActiveImageId}?v=${IMG_VER}`;
  } else {
    imgEl.src = 'https://placehold.co/400x400/f1f5f9/64748b?text=Sin+Foto';
  }
}

function renderModalThumbnails(images) {
  const thumbContainer = document.getElementById("modalThumbnails");
  if (!thumbContainer) return;

  if (images.length <= 1) {
    thumbContainer.innerHTML = "";
    thumbContainer.classList.add("hidden");
    return;
  }

  thumbContainer.classList.remove("hidden");
  thumbContainer.innerHTML = images.map((img) => `
    <button type="button" onclick="setActiveImage(${img.id})" class="w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 ${currentActiveImageId === img.id ? 'border-brand-600 shadow-sm' : 'border-slate-200 opacity-70 hover:opacity-100'} transition cursor-pointer">
      <img src="/api/image/${img.id}?v=${IMG_VER}" class="w-full h-full object-cover" />
    </button>
  `).join("");
}

function syncSelectedVariantByImage(imgId) {
  if (!currentProduct) {
    selectedColor = "";
    return;
  }
  const colors = getColorObjects(currentProduct);
  const images = currentProduct.images || (currentProduct.image_ids ? currentProduct.image_ids.map(id => ({ id })) : []);
  const matched = colors.find(c => String(c.image_id) === String(imgId));

  if (matched) {
    selectedColor = matched.name;
  } else if ((colors.length > 0 || images.length > 1) && images.length > 0 && String(images[0].id) === String(imgId)) {
    selectedColor = "Modelo principal (foto de portada)";
  } else {
    selectedColor = "";
  }
}

window.setActiveImage = function(imgId) {
  currentActiveImageId = imgId;
  updateModalImageDisplay();

  syncSelectedVariantByImage(imgId);
  updateModalWhatsappButton();

  const thumbContainer = document.getElementById("modalThumbnails");
  if (thumbContainer) {
    thumbContainer.querySelectorAll("button").forEach(btn => {
      const isActive = btn.getAttribute("onclick").includes(`setActiveImage(${imgId})`);
      btn.className = isActive
        ? "w-14 h-14 rounded-xl overflow-hidden border-2 border-brand-600 shadow-sm shrink-0 transition cursor-pointer"
        : "w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-200 opacity-70 hover:opacity-100 shrink-0 transition cursor-pointer";
    });
  }
};

function selectColor(col, btnEl) {
  selectedColor = col;
  document.querySelectorAll(".color-btn").forEach(b => {
    b.className = "color-btn px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 transition cursor-pointer";
  });
  btnEl.className = "color-btn px-3 py-1.5 rounded-xl text-xs font-semibold border border-brand-600 bg-brand-50 text-brand-700 transition cursor-pointer";
  updateModalWhatsappButton();
}

function updateModalWhatsappButton() {
  if (!currentProduct) return;
  document.getElementById("modalWhatsappBtn").href =
    buildWhatsAppUrl(currentProduct, getEffectivePrice(currentProduct), pendingRef);
}

function closeProductModal() {
  document.getElementById("productModal").classList.add("hidden");
  document.body.style.overflow = "";
}

let wizardData = { recipient: "", occasion: "", budget: 0 };

function openGiftAssistant() {
  wizardData = { recipient: "", occasion: "", budget: 0 };
  goToWizardStep(1);
  document.getElementById("giftModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function closeGiftAssistant() {
  document.getElementById("giftModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function goToWizardStep(step) {
  document.getElementById("wizardStep1").classList.toggle("hidden", step !== 1);
  document.getElementById("wizardStep2").classList.toggle("hidden", step !== 2);
  document.getElementById("wizardStep3").classList.toggle("hidden", step !== 3);
  document.getElementById("stepIndicator").textContent = `Paso ${step} de 3`;
  document.getElementById("wizardProgress").style.width = `${(step / 3) * 100}%`;
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function selectRecipient(rec) {
  wizardData.recipient = rec;
  goToWizardStep(2);
}

function selectOccasion(occ) {
  wizardData.occasion = occ;
  goToWizardStep(3);
}

function finishGiftAssistant(budget) {
  wizardData.budget = budget;
  closeGiftAssistant();

  state.search = "";
  state.categoryId = "";
  state.maxBudget = budget;
  state.giftContext = { ...wizardData };

  document.getElementById("searchInput").value = "";
  document.getElementById("clearSearchBtn").classList.add("hidden");

  const bText = budget > 200000 ? "presupuesto libre" : `hasta ${formatGs(budget)}`;
  document.getElementById("assistantSummaryText").innerHTML =
    `Regalo para <strong>${esc(wizardData.recipient)}</strong> · Ocasión: <strong>${esc(wizardData.occasion)}</strong> · Presupuesto: <strong>${bText}</strong>`;

  document.getElementById("assistantResultBanner").classList.remove("hidden");
  document.getElementById("catalogTitle").textContent = "🎁 Ideas recomendadas";

  renderProducts();
}

// ---------- Regalito Bot (presentación + consulta en celular y PC) ----------
let bubbleTimer = null;
let typingTimer = null;
let greetingSwitchTimer = null;

function getAllRegalitoBubbles() {
  return [
    document.getElementById("regalitoBubble"),
    document.getElementById("regalitoBubbleMobile")
  ].filter(Boolean);
}

function setRegalitoMessage(text) {
  for (const bubble of getAllRegalitoBubbles()) {
    const span = bubble.querySelector("span");
    if (span) span.textContent = text;
  }
}

function showAllRegalitoBubbles() {
  for (const bubble of getAllRegalitoBubbles()) {
    bubble.classList.remove("hidden");
  }
}

function hideRegalitoBubble() {
  for (const bubble of getAllRegalitoBubbles()) {
    bubble.classList.add("hidden");
  }
  clearTimeout(bubbleTimer);
  clearTimeout(typingTimer);
  clearTimeout(greetingSwitchTimer);
}

function showRegalitoBubble(mode = "default") {
  const bubbles = getAllRegalitoBubbles();
  if (!bubbles.length) return;

  clearTimeout(bubbleTimer);
  clearTimeout(typingTimer);
  clearTimeout(greetingSwitchTimer);

  if (mode === "welcome") {
    setRegalitoMessage("Regalito está escribiendo...");
    showAllRegalitoBubbles();

    typingTimer = setTimeout(() => {
      setRegalitoMessage("¡Hola! Soy Regalito, tu asistente 🤖🎁");
    }, 900);

    greetingSwitchTimer = setTimeout(() => {
      setRegalitoMessage("¿Te ayudo a elegir un regalo hoy?");
    }, 4200);

    bubbleTimer = setTimeout(hideRegalitoBubble, 13000);
    return;
  }

  setRegalitoMessage("¿Te ayudo a elegir un regalo hoy? 🎁");
  showAllRegalitoBubbles();
  bubbleTimer = setTimeout(hideRegalitoBubble, 12000);
}

window.addEventListener("load", () => {
  setTimeout(() => showRegalitoBubble("welcome"), 800);
});

window.addEventListener("scroll", () => {
  if (window.scrollY > 180) hideRegalitoBubble();
}, { passive: true });

document.addEventListener("DOMContentLoaded", () => {
  const waBtn = document.getElementById("modalWhatsappBtn");
  if (waBtn) {
    waBtn.addEventListener("click", () => {
      if (currentProduct && pendingRef) registerLead(pendingRef, currentProduct);
    });
  }
  initCatalog();
});