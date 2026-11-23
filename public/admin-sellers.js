const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPhone = (d) => (d ? `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : '');
const link = (s) => `${location.origin}/?v=${encodeURIComponent(s.slug)}`;
let sellers = [];

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let json = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text }; }
  if (!res.ok) throw new Error(json.error || `Error HTTP ${res.status}`);
  return json;
}

function render() {
  const list = $('#sellersList');
  if (!sellers.length) { list.innerHTML = '<p class="muted">Todavía no hay vendedores. Agregá el primero.</p>'; return; }
  list.innerHTML = sellers.map((s) => `
    <article class="card">
      <div class="card-body">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <h3 class="card-title">${esc(s.name)}</h3>
          <span class="pill ${s.active ? 'pill-ok' : 'pill-warn'}">${s.active ? 'Activo' : 'Inactivo'}</span>
        </div>
        <p class="muted" style="margin:2px 0;">${esc(s.city || 'Sin ciudad')} · ${esc(fmtPhone(s.phone))}</p>
      </div>
      <div class="card-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-copy="${s.id}">Copiar link</button>
        <button type="button" class="btn btn-ghost btn-sm" data-edit="${s.id}">Editar</button>
      </div>
    </article>`).join('');
}

async function load() {
  try {
    const [l, st] = await Promise.all([api('/api/admin/sellers'), api('/api/admin/settings')]);
    sellers = l.sellers;
    $('#bizName').value = st.name || '';
    $('#bizPhone').value = st.default_phone || '';
    render();
  } catch (e) { $('#sellersList').innerHTML = `<p class="error-text">${esc(e.message)}</p>`; }
}

function openSeller(s) {
  $('#sellerError').hidden = true;
  $('#sellerTitle').textContent = s ? 'Editar vendedor' : 'Nuevo vendedor';
  $('#sId').value = s?.id || '';
  $('#sName').value = s?.name || '';
  $('#sCity').value = s?.city || '';
  $('#sPhone').value = s ? fmtPhone(s.phone) : '';
  $('#sActive').value = s && !s.active ? '0' : '1';
  $('#sellerModal').showModal();
}

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-tab="sellers"]')) return load();
  if (e.target.closest('#newSellerBtn')) return openSeller(null);
  if (e.target.closest('#closeSellerBtn')) return $('#sellerModal').close();
  const ed = e.target.closest('[data-edit]');
  if (ed) return openSeller(sellers.find((x) => x.id === Number(ed.dataset.edit)));
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const url = link(sellers.find((x) => x.id === Number(cp.dataset.copy)));
    try { await navigator.clipboard.writeText(url); cp.textContent = '¡Copiado!'; setTimeout(() => (cp.textContent = 'Copiar link'), 1500); }
    catch { prompt('Copiá este link:', url); }
  }
});

$('#sellerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#sellerError').hidden = true; $('#saveSellerBtn').disabled = true;
  try {
    const id = Number($('#sId').value);
    await api('/api/admin/sellers', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ id, name: $('#sName').value, city: $('#sCity').value, phone: $('#sPhone').value, active: Number($('#sActive').value) })
    });
    $('#sellerModal').close(); await load();
  } catch (err) { $('#sellerError').textContent = err.message; $('#sellerError').hidden = false; }
  finally { $('#saveSellerBtn').disabled = false; }
});

$('#bizForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#bizMsg'); msg.hidden = true; msg.className = 'error-text';
  try {
    await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ name: $('#bizName').value, default_phone: $('#bizPhone').value }) });
    msg.textContent = 'Guardado. La tienda lo mostrará en 1–2 minutos.'; msg.className = 'muted';
  } catch (err) { msg.textContent = err.message; }
  msg.hidden = false;
});
