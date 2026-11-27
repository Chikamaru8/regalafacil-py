const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPhone = (d) => (d ? `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : '');
const link = (s) => `${location.origin}/?v=${encodeURIComponent(s.slug)}`;
const DAY_SEC = 86400;
const nowSec = () => Math.floor(Date.now() / 1000);

let sellers = [];
const filters = { search: '', plan: '' };

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text }; }
  if (!res.ok) throw new Error(json.error || `Error HTTP ${res.status}`);
  return json;
}

function fmtShortDate(ts) {
  if (!ts) return 'Sin fecha';
  return new Date(Number(ts) * 1000).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toDateInput(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts) * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPlanInfo(s) {
  const plan = String(s.plan_type || 'trial').toLowerCase();
  if (plan === 'vip') {
    return { key: 'vip', label: '⭐ VIP sin costo', pillClass: 'pill-ok', daysLeft: null, isExpired: false, isExpiring: false };
  }
  const ends = Number(s.plan_ends_at || 0);
  if (!ends) {
    return { key: plan, label: plan === 'paid' ? 'Pago activo' : 'Prueba gratis', pillClass: '', daysLeft: null, isExpired: false, isExpiring: false };
  }
  const diffDays = Math.ceil((ends - nowSec()) / DAY_SEC);
  if (diffDays <= 0) {
    return { key: 'expired', label: `Vencido (${Math.abs(diffDays)}d)`, pillClass: 'pill-warn', daysLeft: diffDays, isExpired: true, isExpiring: false };
  }
  const isExpiring = diffDays <= 7;
  const baseLabel = plan === 'paid' ? 'Pago' : 'Prueba';
  return {
    key: plan,
    label: `${baseLabel} · ${diffDays}d restantes`,
    pillClass: isExpiring ? 'pill-warn' : 'pill-ok',
    daysLeft: diffDays,
    isExpired: false,
    isExpiring
  };
}

function getFilteredSellers() {
  return sellers.filter((s) => {
    if (filters.search) {
      const hay = `${s.name || ''} ${s.city || ''} ${s.phone || ''} ${s.email || ''}`.toLowerCase();
      if (!hay.includes(filters.search)) return false;
    }
    const info = getPlanInfo(s);
    if (filters.plan === 'inactive' && Number(s.active) !== 0) return false;
    if (filters.plan === 'vip' && info.key !== 'vip') return false;
    if (filters.plan === 'trial' && (String(s.plan_type || 'trial') !== 'trial' || info.isExpired)) return false;
    if (filters.plan === 'paid' && (String(s.plan_type) !== 'paid' || info.isExpired)) return false;
    if (filters.plan === 'expiring' && !info.isExpiring) return false;
    if (filters.plan === 'expired' && !info.isExpired) return false;
    return true;
  });
}

function renderMetrics() {
  const box = $('#sellersMetrics');
  if (!box) return;

  const total = sellers.length;
  const activeCount = sellers.filter((s) => Number(s.active) === 1).length;
  const vipCount = sellers.filter((s) => String(s.plan_type) === 'vip').length;
  const expiringCount = sellers.filter((s) => getPlanInfo(s).isExpiring).length;
  const expiredCount = sellers.filter((s) => getPlanInfo(s).isExpired).length;

  box.innerHTML = `
    <div class="metric-card">
      <p class="metric-label">Vendedores</p>
      <p class="metric-val">${total}</p>
      <p class="metric-sub">${activeCount} activos</p>
    </div>
    <div class="metric-card">
      <p class="metric-label">Por vencer (≤7d)</p>
      <p class="metric-val" style="color:#d97706;">${expiringCount}</p>
      <p class="metric-sub">Próximos a renovar</p>
    </div>
    <div class="metric-card">
      <p class="metric-label">Vencidos</p>
      <p class="metric-val" style="color:#e11d48;">${expiredCount}</p>
      <p class="metric-sub">Requieren pago</p>
    </div>
    <div class="metric-card">
      <p class="metric-label">VIP sin costo</p>
      <p class="metric-val" style="color:#15803d;">${vipCount}</p>
      <p class="metric-sub">Acceso libre</p>
    </div>
  `;
}

function render() {
  renderMetrics();
  const list = $('#sellersList');
  const rows = getFilteredSellers();
  if (!rows.length) {
    list.innerHTML = '<p class="muted">No hay vendedores que coincidan con el filtro.</p>';
    return;
  }

  list.innerHTML = rows.map((s) => {
    const info = getPlanInfo(s);
    const prodCount = Number(s.products_count || 0);
    return `
    <article class="card">
      <div class="card-body">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <h3 class="card-title">${esc(s.name)}</h3>
          <span class="pill ${s.active ? 'pill-ok' : 'pill-warn'}">${s.active ? 'Activo' : 'Suspendido'}</span>
          <span class="pill ${info.pillClass}">${esc(info.label)}</span>
          <span class="pill">📦 ${prodCount} ${prodCount === 1 ? 'prod.' : 'prods.'}</span>
        </div>
        <p class="muted" style="margin:4px 0 2px;">${esc(s.city || 'Sin ciudad')} · ${esc(fmtPhone(s.phone))}${s.email ? ` · ${esc(s.email)}` : ''}</p>
        <p class="muted" style="margin:0;font-size:11.5px;">
          Alta: ${esc(fmtShortDate(s.created_at))}
          ${s.plan_type !== 'vip' && s.plan_ends_at ? ` · Vence: ${esc(fmtShortDate(s.plan_ends_at))}` : ''}
          ${s.last_login_at ? ` · Último acceso: ${esc(fmtShortDate(s.last_login_at))}` : ''}
        </p>
      </div>
      <div class="card-actions" style="flex-wrap:wrap;">
        <button type="button" class="btn btn-ghost btn-sm" data-copy="${s.id}">Copiar link</button>
        <button type="button" class="btn btn-ghost btn-sm" data-quick-days="${s.id}" title="Sumar 30 días">+30d</button>
        <button type="button" class="btn btn-ghost btn-sm" data-edit="${s.id}">Editar</button>
      </div>
    </article>`;
  }).join('');
}

async function load() {
  try {
    const [l, st] = await Promise.all([api('/api/admin/sellers'), api('/api/admin/settings')]);
    sellers = l.sellers || [];
    if ($('#bizName')) $('#bizName').value = st.name || '';
    if ($('#bizPhone')) $('#bizPhone').value = st.default_phone || '';
    render();
  } catch (e) {
    if ($('#sellersList')) $('#sellersList').innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
  }
}

function togglePlanEndsVisibility() {
  const wrap = $('#sPlanEndsWrap');
  const planSel = $('#sPlanType');
  if (wrap && planSel) {
    wrap.hidden = planSel.value === 'vip';
  }
}

function openSeller(s) {
  if (!$('#sellerModal')) return;
  $('#sellerError').hidden = true;
  $('#sellerTitle').textContent = s ? 'Editar vendedor' : 'Nuevo vendedor';
  $('#sId').value = s?.id || '';
  $('#sName').value = s?.name || '';
  $('#sCity').value = s?.city || '';
  $('#sPhone').value = s ? fmtPhone(s.phone) : '';
  $('#sEmail').value = s?.email || '';
  $('#sActive').value = s && !s.active ? '0' : '1';
  $('#sPlanType').value = s?.plan_type || 'trial';
  $('#sPlanEnds').value = s?.plan_ends_at ? toDateInput(s.plan_ends_at) : toDateInput(nowSec() + 60 * DAY_SEC);
  $('#deleteSellerBtn').hidden = !s;
  togglePlanEndsVisibility();
  $('#sellerModal').showModal();
}

$('#sPlanType')?.addEventListener('change', togglePlanEndsVisibility);

$('#sellerSearchInput')?.addEventListener('input', (e) => {
  filters.search = e.target.value.trim().toLowerCase();
  render();
});

$('#sellerPlanFilter')?.addEventListener('change', (e) => {
  filters.plan = e.target.value;
  render();
});

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-tab="sellers"]')) return load();
  if (e.target.closest('#newSellerBtn')) return openSeller(null);
  if (e.target.closest('#closeSellerBtn')) return $('#sellerModal')?.close();

  const addBtn = e.target.closest('[data-add-days]');
  if (addBtn) {
    const days = Number(addBtn.dataset.addDays) || 30;
    const currentStr = $('#sPlanEnds')?.value;
    const baseMs = currentStr ? Math.max(Date.now(), new Date(currentStr + 'T12:00:00').getTime()) : Date.now();
    $('#sPlanEnds').value = toDateInput(Math.floor(baseMs / 1000) + days * DAY_SEC);
    return;
  }

  const quickBtn = e.target.closest('[data-quick-days]');
  if (quickBtn) {
    const s = sellers.find((x) => x.id === Number(quickBtn.dataset.quickDays));
    if (!s) return;
    if (!confirm(`¿Sumar 30 días al plan de "${s.name}"?`)) return;
    try {
      await api('/api/admin/sellers', {
        method: 'PUT',
        body: JSON.stringify({
          id: s.id,
          name: s.name,
          city: s.city || '',
          phone: s.phone,
          email: s.email || '',
          active: 1,
          plan_type: s.plan_type === 'vip' ? 'paid' : (s.plan_type || 'trial'),
          add_days: 30
        })
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  const ed = e.target.closest('[data-edit]');
  if (ed) return openSeller(sellers.find((x) => x.id === Number(ed.dataset.edit)));

  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const url = link(sellers.find((x) => x.id === Number(cp.dataset.copy)));
    try {
      await navigator.clipboard.writeText(url);
      cp.textContent = '¡Copiado!';
      setTimeout(() => (cp.textContent = 'Copiar link'), 1500);
    } catch {
      prompt('Copiá este link:', url);
    }
  }
});

$('#deleteSellerBtn')?.addEventListener('click', async () => {
  const id = Number($('#sId').value);
  const name = $('#sName').value.trim();
  if (!id) return;
  if (!confirm(`¿Eliminar definitivamente a "${name}"? Sus productos quedarán sin vendedor asignado.`)) return;

  $('#deleteSellerBtn').disabled = true;
  try {
    await api(`/api/admin/sellers?id=${id}`, { method: 'DELETE' });
    $('#sellerModal').close();
    await load();
  } catch (err) {
    $('#sellerError').textContent = err.message;
    $('#sellerError').hidden = false;
  } finally {
    $('#deleteSellerBtn').disabled = false;
  }
});

$('#sellerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#sellerError').hidden = true;
  $('#saveSellerBtn').disabled = true;
  try {
    const id = Number($('#sId').value);
    const planType = $('#sPlanType').value;
    const dateVal = $('#sPlanEnds').value;
    const planEndsAt = planType === 'vip'
      ? null
      : (dateVal ? Math.floor(new Date(dateVal + 'T23:59:59').getTime() / 1000) : null);

    await api('/api/admin/sellers', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        id,
        name: $('#sName').value,
        city: $('#sCity').value,
        phone: $('#sPhone').value,
        email: $('#sEmail').value,
        active: Number($('#sActive').value),
        plan_type: planType,
        plan_ends_at: planEndsAt
      })
    });
    $('#sellerModal').close();
    await load();
  } catch (err) {
    $('#sellerError').textContent = err.message;
    $('#sellerError').hidden = false;
  } finally {
    $('#saveSellerBtn').disabled = false;
  }
});

$('#bizForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#bizMsg');
  msg.hidden = true;
  msg.className = 'error-text';
  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ name: $('#bizName').value, default_phone: $('#bizPhone').value })
    });
    msg.textContent = 'Guardado. La tienda lo mostrará en 1–2 minutos.';
    msg.className = 'muted';
  } catch (err) {
    msg.textContent = err.message;
  }
  msg.hidden = false;
});