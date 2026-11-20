const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const gs = n => 'Gs. ' + Number(n || 0).toLocaleString('es-PY');
const now = () => Math.floor(Date.now() / 1000);

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

const S = {
  data: null,
  cat: null,
  q: '',
  rng: '',
  cart: ls.get('cart', []),
  sug: null,
  cur: null,
  qty: 1,
  g: { recipient: null, occasion: null, age: null, budget: null }
};

// Vendedor interno por enlace (?v=slug) guardado 30 días, sin exhibirse al público
let vslug = new URLSearchParams(location.search).get('v');
if (vslug) {
  ls.set('seller', { slug: vslug, t: Date.now() });
} else {
  const s = ls.get('seller', null);
  if (s && Date.now() - s.t < 30 * 864e5) vslug = s.slug;
}

const price = p => (p.offer_price_gs != null && (!p.offer_ends_at || p.offer_ends_at > now()))
  ? p.offer_price_gs
  : p.price_gs;
const onOffer = p => price(p) < p.price_gs;

const timeLeft = p => {
  if (!p.offer_ends_at || !onOffer(p)) return '';
  const h = Math.floor((p.offer_ends_at - now()) / 3600);
  return h < 1 ? 'Termina en menos de 1 h' : h < 48 ? `Termina en ${h} h` : `Termina en ${Math.floor(h / 24)} días`;
};

const ranges = () => S.data.settings.selector?.budget_ranges || [];
const rngLabel = ([a, b]) => b == null ? `Más de ${gs(a)}` : a === 0 ? `Hasta ${gs(b)}` : `${gs(a)} – ${gs(b)}`;
const inRange = (p, r) => {
  const x = price(p);
  return x >= r[0] && (r[1] == null || x < r[1]);
};
const byId = id => S.data.products.find(p => p.id === id);

function visible() {
  let l = S.data.products;
  if (S.cat) l = l.filter(p => p.category_id === S.cat);
  if (S.q) {
    const q = norm(S.q);
    l = l.filter(p => norm(p.name + ' ' + p.description).includes(q));
  }
  if (S.rng !== '') l = l.filter(p => inRange(p, ranges()[S.rng]));
  return l;
}

function card(p) {
  const img = p.image_ids[0] ? `<img loading="lazy" alt="${esc(p.name)}" src="/api/image/${p.image_ids[0]}">` : '🎁';
  const old = onOffer(p) ? `<s>${gs(p.price_gs)}</s>` : '';
  const left = timeLeft(p);
  return `<article class="card" data-act="open" data-id="${p.id}">
    <div class="ph">${img}${onOffer(p) ? '<span class="badge">OFERTA</span>' : ''}</div>
    <div class="b">
      <h3>${esc(p.name)}</h3>
      <div class="pr"><b>${gs(price(p))}</b>${old}</div>
      ${left ? `<div class="left">${left}</div>` : ''}
      <div class="add"><button data-act="add" data-id="${p.id}" type="button">Agregar</button></div>
    </div>
  </article>`;
}

function renderBudgets() {
  const list = ranges();
  const activeText = S.rng === '' ? 'Todos' : rngLabel(list[S.rng]);
  $('#budgetLabel').textContent = activeText;

  $('#budgetChips').innerHTML = [
    `<button class="chip${S.rng === '' ? ' on' : ''}" data-act="rng" data-v="" type="button">Todos</button>`
  ].concat(
    list.map((r, i) => `<button class="chip${String(S.rng) === String(i) ? ' on' : ''}" data-act="rng" data-v="${i}" type="button">${rngLabel(r)}</button>`)
  ).join('');
}

function renderCategories() {
  $('#cats').innerHTML = [
    `<button class="chip cat-chip${S.cat ? '' : ' on'}" data-act="cat" data-id="" type="button">✨ Todo</button>`
  ].concat(
    S.data.categories.map(c => `<button class="chip cat-chip${S.cat === c.id ? ' on' : ''}" data-act="cat" data-id="${c.id}" type="button">${esc(c.name)}</button>`)
  ).join('');
}

function render() {
  const bizName = S.data.settings.business?.name || 'RegaláFácil PY';
  document.title = bizName;

  const rawPhone = String(S.data.seller?.phone || S.data.settings.business?.default_phone || '').replace(/\D/g, '');
  if (rawPhone) {
    $('#topPhone').textContent = '+' + rawPhone.replace(/^595/, '595 ');
  }

  renderBudgets();
  renderCategories();

  const list = S.sug ? S.sug.list : visible();
  $('#listTitle').textContent = S.sug ? 'Regalos recomendados para vos' : 'Opciones disponibles';
  $('#listCount').textContent = `${list.length} ${list.length === 1 ? 'opción' : 'opciones'}`;

  $('#banner').innerHTML = S.sug
    ? `<div class="ban">
        <span>Filtramos según tu elección${S.sug.relaxed ? '<br><small>Ampliamos el presupuesto para mostrarte más alternativas.</small>' : ''}</span>
        <button class="chip" data-act="clear" type="button">Ver todo</button>
      </div>`
    : '';

  $('#grid').innerHTML = list.length
    ? list.map(card).join('')
    : `<p class="empty">${S.data.products.length ? 'No encontramos opciones con esos filtros.' : 'Pronto vamos a cargar regalos y novedades 🙂'}</p>`;

  renderBar();
}

function renderBar() {
  const n = S.cart.reduce((s, i) => s + i.qty, 0);
  const t = S.cart.reduce((s, i) => s + i.qty * i.price, 0);
  $('#bar').hidden = !n;
  $('#bar button').textContent = `🛒 Ver pedido (${n}) · ${gs(t)}`;
}

function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 1600);
}

const dlg = $('#dlg');
const hd = t => `<div class="hd"><h2>${t}</h2><button class="x" data-act="close" type="button" aria-label="Cerrar">✕</button></div>`;

function openDlg(html) {
  dlg.innerHTML = `<div class="in">${html}</div>`;
  if (!dlg.open) dlg.showModal();
}

dlg.addEventListener('click', e => {
  if (e.target === dlg) dlg.close();
});

function productDlg(p) {
  const imgs = p.image_ids.length
    ? `<div class="gal">${p.image_ids.map(i => `<img alt="${esc(p.name)}" src="/api/image/${i}">`).join('')}</div>`
    : '';
  const attrs = Object.entries(p.attributes || {}).map(([k, v]) => `<span>${esc(k)}: ${esc(v)}</span>`).join('');
  const old = onOffer(p) ? ` <s>${gs(p.price_gs)}</s>` : '';
  S.cur = p.id;
  S.qty = 1;

  openDlg(`${hd(esc(p.name))}${imgs}
    <div class="pr" style="font-size:20px"><b>${gs(price(p))}</b>${old}</div>
    ${timeLeft(p) ? `<div class="left">${timeLeft(p)}</div>` : ''}
    <p style="margin:8px 0">${esc(p.description || '')}</p>
    <div class="attrs">${attrs}</div>
    <div class="qty">
      <button data-act="dec" type="button">−</button>
      <span id="qv">1</span>
      <button data-act="inc" type="button">+</button>
    </div>
    <button class="cta" data-act="addq" id="addq" type="button">Agregar al pedido · ${gs(price(p))}</button>`);
}

function giftDlg() {
  const g = S.g;
  const tags = S.data.tags || [];
  const grp = (k, label) => `<h4>${label}</h4><div class="chips wrap">` +
    tags.filter(t => t.group_key === k)
      .map(t => `<button class="chip${g[k] === t.id ? ' on' : ''}" data-act="gset" data-k="${k}" data-v="${t.id}" type="button">${esc(t.label)}</button>`)
      .join('') +
    '</div>';

  const bud = ranges()
    .map((r, i) => `<button class="chip${g.budget === i ? ' on' : ''}" data-act="gset" data-k="budget" data-v="${i}" type="button">${rngLabel(r)}</button>`)
    .join('');

  openDlg(`${hd('Ayuda para elegir regalo')}
    <p style="margin:0 0 8px;font-size:13px;color:var(--muted)">Marcá lo que tengas en mente y te sugerimos opciones del catálogo.</p>
    ${grp('recipient', '¿Para quién es?')}
    ${grp('occasion', '¿Qué ocasión?')}
    <h4>Presupuesto</h4>
    <div class="chips wrap">${bud}</div>
    ${grp('age', 'Edad (opcional)')}
    <button class="cta" data-act="suggest" type="button">Ver opciones recomendadas</button>`);
}

function cartDlg() {
  if (!S.cart.length) {
    openDlg(`${hd('Tu pedido')}<p class="empty">Todavía no agregaste productos.</p>`);
    return;
  }
  const t = S.cart.reduce((s, i) => s + i.qty * i.price, 0);
  const rows = S.cart.map((i, k) => `<div class="ci">
    <div>${esc(i.name)}<br><small>${gs(i.price)} c/u</small></div>
    <div class="qty">
      <button data-act="cdec" data-k="${k}" type="button">−</button>
      <span>${i.qty}</span>
      <button data-act="cinc" data-k="${k}" type="button">+</button>
    </div>
  </div>`).join('');

  openDlg(`${hd('Tu pedido')}${rows}
    <div class="ci"><b>Total estimado</b><b>${gs(t)}</b></div>
    <h4>Tu nombre (opcional)</h4>
    <input id="cname" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px" placeholder="Ej. Marcelo" value="${esc(ls.get('name', ''))}">
    <button class="cta" data-act="send" type="button">Pedir por WhatsApp</button>
    <button class="link" data-act="empty" type="button">Vaciar pedido</button>`);
}

function suggest() {
  const g = S.g;
  const sel = [g.recipient, g.occasion, g.age].filter(Boolean);
  const r = g.budget != null ? ranges()[g.budget] : [0, null];
  const scored = S.data.products.map(p => ({
    p,
    s: sel.filter(t => (p.tag_ids || []).includes(t)).length
  }));

  let pool = scored.filter(x => (!sel.length || x.s > 0) && inRange(x.p, r));
  let relaxed = false;

  if (!pool.length) {
    pool = scored.filter(x => !sel.length || x.s > 0);
    relaxed = true;
  }
  if (!pool.length) pool = scored;

  pool.sort((a, b) => b.s - a.s || price(a.p) - price(b.p));
  return { list: pool.slice(0, 6).map(x => x.p), relaxed };
}

function addToCart(p, qty) {
  const it = S.cart.find(i => i.id === p.id);
  if (it) {
    it.qty += qty;
    it.price = price(p);
  } else {
    S.cart.push({ id: p.id, name: p.name, price: price(p), qty });
  }
  ls.set('cart', S.cart);
  renderBar();
  toast('Agregado al pedido ✓');
}

function setQty(k, d) {
  S.cart[k].qty += d;
  if (S.cart[k].qty < 1) S.cart.splice(k, 1);
  ls.set('cart', S.cart);
  renderBar();
  cartDlg();
}

function mkref() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(r, x => a[x % a.length]).join('');
}

function sendOrder() {
  if (!S.cart.length) return;
  const name = ($('#cname')?.value || '').trim();
  ls.set('name', name);

  const seller = S.data.seller;
  const biz = S.data.settings.business || {};
  const ref = mkref();
  const total = S.cart.reduce((s, i) => s + i.qty * i.price, 0);
  const lines = S.cart.map(i => `• ${i.qty} x ${i.name} (${gs(i.price)})`).join('\n');
  const msg = `Hola! Quiero consultar por este pedido en ${biz.name || 'RegaláFácil PY'}:\n${lines}\nTotal estimado: ${gs(total)}${name ? '\nNombre: ' + name : ''}\nRef: ${ref}`;
  const phone = String(seller?.phone || biz.default_phone || '').replace(/\D/g, '');

  try {
    fetch('/api/leads', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref,
        seller_id: seller?.id || null,
        customer_name: name || null,
        items: S.cart.map(i => ({
          product_id: i.id,
          product_name: i.name,
          qty: i.qty,
          unit_price_gs: i.price
        }))
      })
    }).catch(() => {});
  } catch {}

  location.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;

  const a = el.dataset.act;
  const id = Number(el.dataset.id);
  const k = Number(el.dataset.k);

  switch (a) {
    case 'open':
      productDlg(byId(id));
      break;
    case 'add':
      e.stopPropagation();
      addToCart(byId(id), 1);
      break;
    case 'rng':
      S.rng = el.dataset.v;
      S.sug = null;
      render();
      break;
    case 'cat':
      S.cat = id || null;
      S.sug = null;
      render();
      break;
    case 'resetAll':
      S.cat = null;
      S.q = '';
      S.rng = '';
      S.sug = null;
      $('#q').value = '';
      render();
      break;
    case 'gift':
      giftDlg();
      break;
    case 'gset': {
      const key = el.dataset.k;
      const v = Number(el.dataset.v);
      S.g[key] = S.g[key] === v ? null : v;
      giftDlg();
      break;
    }
    case 'suggest':
      S.sug = suggest();
      dlg.close();
      render();
      scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'clear':
      S.sug = null;
      render();
      break;
    case 'inc':
    case 'dec': {
      S.qty = Math.max(1, S.qty + (a === 'inc' ? 1 : -1));
      $('#qv').textContent = S.qty;
      $('#addq').textContent = `Agregar al pedido · ${gs(price(byId(S.cur)) * S.qty)}`;
      break;
    }
    case 'addq':
      addToCart(byId(S.cur), S.qty);
      dlg.close();
      break;
    case 'cart':
      cartDlg();
      break;
    case 'cinc':
      setQty(k, 1);
      break;
    case 'cdec':
      setQty(k, -1);
      break;
    case 'empty':
      S.cart = [];
      ls.set('cart', S.cart);
      renderBar();
      dlg.close();
      break;
    case 'send':
      sendOrder();
      break;
    case 'close':
      dlg.close();
      break;
  }
});

$('#q').addEventListener('input', e => {
  S.q = e.target.value;
  S.sug = null;
  render();
});

function applyTheme(t) {
  let name = t?.default || 'base';
  const d = new Date().toISOString().slice(0, 10);
  for (const s of (t?.schedule || [])) {
    if (s.from <= d && d <= s.to) name = s.theme;
  }
  document.documentElement.dataset.theme = name;
}

(async function init() {
  try {
    const r = await fetch('/api/catalog' + (vslug ? '?v=' + encodeURIComponent(vslug) : ''));
    if (!r.ok) throw new Error();
    S.data = await r.json();
  } catch {
    $('#grid').innerHTML = '<p class="empty">No pudimos cargar el catálogo.<br><br><button class="chip" onclick="location.reload()" type="button">Reintentar</button></p>';
    return;
  }

  applyTheme(S.data.settings.themes);
  render();
})();