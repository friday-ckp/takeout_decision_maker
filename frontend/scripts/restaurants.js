/**
 * restaurants.js — 餐厅列表 & 管理（Sprint 2 完整版）
 */

let restaurantList = [];
let editingRestaurantId = null;
let editSelectedTags = [];

const FLAVOR_TAGS = ['重口', '清淡', '咸', '甜', '辣', '快手', '便宜', '健康', '素食', '海鲜'];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 渲染餐厅网格 ──────────────────────────────────────────────────
function renderRestaurantList(list) {
  const container  = document.getElementById('restaurant-list');
  const countEl    = document.getElementById('restaurant-count');
  const emptyEl    = document.getElementById('restaurants-empty');
  const skeletonEl = document.getElementById('restaurants-skeleton');

  if (skeletonEl) skeletonEl.classList.add('hidden');

  if (!list || list.length === 0) {
    container.innerHTML = '';
    if (emptyEl)  emptyEl.classList.remove('hidden');
    if (countEl)  countEl.textContent = '';
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  if (countEl) countEl.textContent = `共 ${list.length} 家餐厅`;

  container.innerHTML = list.map(r => `
    <div class="restaurant-card" data-id="${r.id}">
      <div class="restaurant-card__header">
        <span class="restaurant-card__name">${escapeHtml(r.name)}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <button class="fav-btn${r.isFavorite ? ' active' : ''}" data-action="favorite" data-id="${r.id}"
                  aria-label="${r.isFavorite ? '取消收藏' : '收藏'}" title="${r.isFavorite ? '取消收藏' : '收藏'}">
            <svg viewBox="0 0 24 24" fill="${r.isFavorite ? 'currentColor' : 'none'}"
                 stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <button class="icon-btn" data-action="edit" data-id="${r.id}" title="编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${r.id}" title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
          <button class="icon-btn${r.isBlocked ? ' icon-btn--active-danger' : ''}" data-action="block" data-id="${r.id}" title="${r.isBlocked ? '解除拉黑' : '拉黑'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </button>
        </div>
      </div>
      ${r.category ? `<span class="restaurant-card__category">${escapeHtml(r.category)}</span>` : ''}
      ${r.tags && r.tags.length ? `
        <div class="restaurant-card__tags">
          ${r.tags.map(t => `<span class="chip" style="cursor:default">${escapeHtml(t)}</span>`).join('')}
        </div>` : ''}
      ${r.notes ? `<p class="restaurant-card__notes">${escapeHtml(r.notes)}</p>` : ''}
    </div>
  `).join('');

  // 事件代理
  container.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const rid = parseInt(id, 10);
    if (action === 'favorite') await handleToggleFavorite(rid);
    if (action === 'edit')     openEditPanel(rid);
    if (action === 'delete')   await handleDeleteRestaurant(rid);
    if (action === 'block')    await handleToggleBlock(rid);
  };
}

// ── 骨架屏 ────────────────────────────────────────────────────────
function showSkeleton() {
  const skeletonEl = document.getElementById('restaurants-skeleton');
  const container  = document.getElementById('restaurant-list');
  const emptyEl    = document.getElementById('restaurants-empty');

  if (skeletonEl) skeletonEl.classList.remove('hidden');
  if (container)  container.innerHTML = '';
  if (emptyEl)    emptyEl.classList.add('hidden');
}

// ── 加载餐厅数据 ──────────────────────────────────────────────────
async function loadRestaurants() {
  showSkeleton();
  try {
    const data = await api.get('/api/restaurants');
    restaurantList = data.list || [];
    renderRestaurantList(restaurantList);
    updateStats(restaurantList);
    updateHomeDecisionButton(restaurantList.length);
  } catch (err) {
    document.getElementById('restaurants-skeleton')?.classList.add('hidden');
    document.getElementById('restaurants-empty')?.classList.remove('hidden');
    updateHomeDecisionButton(0);
    console.warn('API 不可用:', err.message);
  }
}

// ── 更新右侧统计卡片 ──────────────────────────────────────────────
function updateStats(list) {
  const total    = list.length;
  const favorite = list.filter(r => r.isFavorite).length;

  const statTotal    = document.getElementById('stat-total');
  const statFavorite = document.getElementById('stat-favorite');
  const statLast     = document.getElementById('stat-last');

  if (statTotal)    statTotal.textContent    = total;
  if (statFavorite) statFavorite.textContent = favorite;
  if (statLast)     statLast.textContent     = '—';
}

// ── 首页「开始决策」按钮状态 ──────────────────────────────────────
function updateHomeDecisionButton(count) {
  const btn     = document.getElementById('btn-start-decision');
  const hint    = document.getElementById('home-empty-hint');
  const loading = document.getElementById('home-loading-hint');
  const addBtn  = document.getElementById('btn-home-goto-add');

  if (loading) loading.classList.add('hidden');
  if (!btn) return;

  if (count < 2) {
    btn.disabled = true;
    const msg = count === 0 ? '还没有餐厅，添加后才能开始决策' : '至少需要2家餐厅才能开始决策';
    if (hint)   { hint.textContent = msg; hint.classList.remove('hidden'); }
    if (addBtn) addBtn.classList.remove('hidden');
  } else {
    btn.disabled = false;
    if (hint)   hint.classList.add('hidden');
    if (addBtn) addBtn.classList.add('hidden');
  }
}

// ── 标签选择（添加表单）──────────────────────────────────────────
let selectedTags = [];

function initTagChips() {
  const container = document.getElementById('add-tags-container');
  if (!container) return;

  container.innerHTML = FLAVOR_TAGS.map(tag => `
    <button type="button" class="chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
  `).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
        chip.classList.remove('active');
      } else {
        if (selectedTags.length >= 10) return;
        selectedTags.push(tag);
        chip.classList.add('active');
      }
    });
  });
}

function clearAddForm() {
  document.getElementById('add-restaurant-form')?.reset();
  selectedTags = [];
  document.querySelectorAll('#add-tags-container .chip').forEach(c => c.classList.remove('active'));
  const nameErr = document.getElementById('add-name-error');
  if (nameErr) nameErr.textContent = '';
}

// ── 提交添加餐厅 ──────────────────────────────────────────────────
async function submitAddRestaurant(e) {
  e.preventDefault();

  const nameInput     = document.getElementById('add-name');
  const categoryInput = document.getElementById('add-category');
  const notesInput    = document.getElementById('add-notes');
  const nameErr       = document.getElementById('add-name-error');
  const submitBtn     = document.getElementById('add-submit-btn');

  const name = nameInput?.value?.trim() || '';
  if (!name) {
    if (nameErr) nameErr.textContent = '请输入餐厅名称';
    nameInput?.focus();
    return;
  }
  if (nameErr) nameErr.textContent = '';

  submitBtn.disabled = true;
  submitBtn.textContent = '保存中…';

  try {
    await api.post('/api/restaurants', {
      name,
      category: categoryInput?.value?.trim() || '',
      tags: [...selectedTags],
      notes: notesInput?.value?.trim() || '',
    });

    clearAddForm();
    closeAddPanel();
    showToast('添加成功', 'success');
    await loadRestaurants();
    if (currentPage === 'home') navigate('restaurants');
  } catch (err) {
    showToast(err.message || '添加失败', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '保存';
  }
}

// ── 编辑餐厅 (Story 1.12) ─────────────────────────────────────────
function openEditPanel(restaurantId) {
  const restaurant = restaurantList.find(r => r.id === restaurantId);
  if (!restaurant) return;

  editingRestaurantId = restaurantId;
  editSelectedTags = [...(restaurant.tags || [])];

  document.getElementById('edit-name').value     = restaurant.name;
  document.getElementById('edit-category').value = restaurant.category || '';
  document.getElementById('edit-notes').value    = restaurant.notes || '';

  // 初始化标签
  const container = document.getElementById('edit-tags-container');
  container.innerHTML = FLAVOR_TAGS.map(tag => `
    <button type="button" class="chip${editSelectedTags.includes(tag) ? ' active' : ''}"
            data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
  `).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (editSelectedTags.includes(tag)) {
        editSelectedTags = editSelectedTags.filter(t => t !== tag);
        chip.classList.remove('active');
      } else {
        if (editSelectedTags.length >= 10) return;
        editSelectedTags.push(tag);
        chip.classList.add('active');
      }
    });
  });

  document.getElementById('edit-panel').classList.add('open');
  document.getElementById('edit-panel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEditPanel() {
  document.getElementById('edit-panel').classList.remove('open');
  document.getElementById('edit-panel-overlay').classList.remove('open');
  document.body.style.overflow = '';
  editingRestaurantId = null;
}

async function submitEditRestaurant(e) {
  e.preventDefault();
  if (!editingRestaurantId) return;

  const nameInput  = document.getElementById('edit-name');
  const nameErr    = document.getElementById('edit-name-error');
  const submitBtn  = document.getElementById('edit-submit-btn');
  const name = nameInput?.value?.trim() || '';

  if (!name) {
    if (nameErr) nameErr.textContent = '请输入餐厅名称';
    nameInput?.focus();
    return;
  }
  if (nameErr) nameErr.textContent = '';

  submitBtn.disabled = true;
  submitBtn.textContent = '保存中…';

  try {
    await api.put(`/api/restaurants/${editingRestaurantId}`, {
      name,
      category: document.getElementById('edit-category')?.value?.trim() || '',
      tags: [...editSelectedTags],
      notes: document.getElementById('edit-notes')?.value?.trim() || '',
    });
    closeEditPanel();
    showToast('修改成功', 'success');
    await loadRestaurants();
  } catch (err) {
    showToast(err.message || '修改失败', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '保存';
  }
}

// ── 删除餐厅（软删除, Story 1.13）────────────────────────────────
async function handleDeleteRestaurant(restaurantId) {
  const restaurant = restaurantList.find(r => r.id === restaurantId);
  if (!restaurant) return;
  if (!confirm(`确定要删除「${restaurant.name}」吗？\n删除后可在回收站还原（7天内）。`)) return;

  try {
    await api.delete(`/api/restaurants/${restaurantId}`);
    showToast('已删除，可在回收站还原', 'success');
    await loadRestaurants();
  } catch (err) {
    showToast(err.message || '删除失败', 'error');
  }
}

// ── 收藏切换（Story 1.15）────────────────────────────────────────
async function handleToggleFavorite(restaurantId) {
  try {
    const data = await api.post(`/api/restaurants/${restaurantId}/favorite`, {});
    const idx = restaurantList.findIndex(r => r.id === restaurantId);
    if (idx !== -1) restaurantList[idx].isFavorite = data.isFavorite;
    showToast(data.isFavorite ? '已收藏' : '已取消收藏', 'success');
    renderRestaurantList(restaurantList);
    updateStats(restaurantList);
  } catch (err) {
    showToast(err.message || '操作失败', 'error');
  }
}

// ── 拉黑切换（Story 1.17）────────────────────────────────────────
async function handleToggleBlock(restaurantId) {
  const restaurant = restaurantList.find(r => r.id === restaurantId);
  if (!restaurant) return;

  const isBlocked = !!restaurant.isBlocked;
  const action = isBlocked ? '解除拉黑' : '拉黑';
  if (!isBlocked && !confirm(`确定要拉黑「${restaurant.name}」吗？\n拉黑后不会出现在候选列表中。`)) return;

  try {
    const data = await api.post(`/api/restaurants/${restaurantId}/block`, {});
    const idx = restaurantList.findIndex(r => r.id === restaurantId);
    if (idx !== -1) restaurantList[idx].isBlocked = data.isBlocked;
    showToast(data.isBlocked ? '已拉黑' : '已解除拉黑', 'success');
    await loadRestaurants();
  } catch (err) {
    showToast(err.message || `${action}失败`, 'error');
  }
}

// ── 回收站（Story 1.13/1.14）─────────────────────────────────────
async function loadTrash() {
  const container = document.getElementById('trash-list');
  if (!container) return;
  container.innerHTML = '<p style="color:#aaa;font-size:13px">加载中…</p>';

  try {
    const data = await api.get('/api/restaurants/trash');
    const list = data.list || [];

    if (list.length === 0) {
      container.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:24px">回收站为空</p>';
      return;
    }

    container.innerHTML = list.map(r => `
      <div class="trash-item" data-id="${r.id}">
        <div style="flex:1">
          <span style="font-weight:600">${escapeHtml(r.name)}</span>
          ${r.category ? `<span class="restaurant-card__category" style="margin-left:8px">${escapeHtml(r.category)}</span>` : ''}
          <p style="font-size:12px;color:#aaa;margin-top:4px">删除于 ${formatDate(r.deletedAt)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-action="restore" data-id="${r.id}">还原</button>
        <button class="btn btn-secondary btn-sm" style="color:#ef4444" data-action="purge" data-id="${r.id}">彻底删除</button>
      </div>
    `).join('');

    container.onclick = async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'restore') await restoreFromTrash(parseInt(id, 10));
      if (action === 'purge')   showToast('彻底删除功能将在后续版本支持', 'info');
    };
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;font-size:13px">${err.message}</p>`;
  }
}

async function restoreFromTrash(restaurantId) {
  try {
    await api.post(`/api/restaurants/${restaurantId}/restore`, {});
    showToast('已还原', 'success');
    await loadTrash();
    await loadRestaurants();
  } catch (err) {
    showToast(err.message || '还原失败', 'error');
  }
}

// ── 收藏列表（Story 1.15/1.16）───────────────────────────────────
async function loadFavorites() {
  const container = document.getElementById('favorites-list');
  if (!container) return;
  container.innerHTML = '<p style="color:#aaa;font-size:13px">加载中…</p>';

  try {
    const data = await api.get('/api/restaurants');
    const list = (data.list || []).filter(r => r.isFavorite);

    if (list.length === 0) {
      container.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:24px">暂无收藏餐厅<br>在餐厅列表中点击 ❤ 收藏</p>';
      return;
    }

    container.innerHTML = list.map(r => `
      <div class="trash-item">
        <div style="flex:1">
          <span style="font-weight:600">${escapeHtml(r.name)}</span>
          ${r.category ? `<span class="restaurant-card__category" style="margin-left:8px">${escapeHtml(r.category)}</span>` : ''}
          ${r.tags && r.tags.length ? `<div class="restaurant-card__tags" style="margin-top:6px">${r.tags.map(t => `<span class="chip" style="cursor:default">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
        <button class="fav-btn active" data-action="unfav" data-id="${r.id}" title="取消收藏" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
    `).join('');

    container.onclick = async (e) => {
      const btn = e.target.closest('[data-action="unfav"]');
      if (!btn) return;
      await handleToggleFavorite(parseInt(btn.dataset.id, 10));
      await loadFavorites();
    };
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;font-size:13px">${err.message}</p>`;
  }
}

// ── 黑名单（Story 1.17/1.18）─────────────────────────────────────
async function loadBlacklist() {
  const container = document.getElementById('blacklist-list');
  if (!container) return;
  container.innerHTML = '<p style="color:#aaa;font-size:13px">加载中…</p>';

  try {
    const data = await api.get('/api/restaurants/blacklist');
    const list = data.list || [];

    if (list.length === 0) {
      container.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:24px">黑名单为空</p>';
      return;
    }

    container.innerHTML = list.map(r => `
      <div class="trash-item">
        <div style="flex:1">
          <span style="font-weight:600">${escapeHtml(r.name)}</span>
          ${r.category ? `<span class="restaurant-card__category" style="margin-left:8px">${escapeHtml(r.category)}</span>` : ''}
          <p style="font-size:12px;color:#aaa;margin-top:4px">拉黑于 ${formatDate(r.blockedAt)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-action="unblock" data-id="${r.id}">解除拉黑</button>
      </div>
    `).join('');

    container.onclick = async (e) => {
      const btn = e.target.closest('[data-action="unblock"]');
      if (!btn) return;
      try {
        await api.post(`/api/restaurants/${btn.dataset.id}/block`, {});
        showToast('已解除拉黑', 'success');
        await loadBlacklist();
        await loadRestaurants();
      } catch (err) {
        showToast(err.message || '操作失败', 'error');
      }
    };
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;font-size:13px">${err.message}</p>`;
  }
}

// ── JSON 批量导入（Story 1.10/1.11）──────────────────────────────
async function handleBatchImport() {
  const textarea = document.getElementById('import-json-textarea');
  const resultEl = document.getElementById('import-result');
  const btn      = document.getElementById('btn-import-submit');

  const raw = textarea?.value?.trim();
  if (!raw) { showToast('请输入 JSON 内容', 'error'); return; }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    showToast('JSON 格式错误，请检查', 'error');
    return;
  }

  // 支持数组或 { restaurants: [] } 格式
  const restaurants = Array.isArray(data) ? data : (data.restaurants || []);
  if (restaurants.length === 0) {
    showToast('没有找到可导入的数据', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = '导入中…';

  try {
    const result = await api.post('/api/restaurants/import', { restaurants });
    const { imported, skipped, errors } = result;
    if (resultEl) {
      resultEl.innerHTML = `<div class="import-result success">
        ✅ 成功导入 <strong>${imported}</strong> 家，跳过 <strong>${skipped}</strong> 家（同名或格式错误）
        ${errors && errors.length ? `<br><small>错误详情：${errors.map(e => `第${e.index+1}条: ${e.reason}`).join('；')}</small>` : ''}
      </div>`;
    }
    textarea.value = '';
    await loadRestaurants();
    showToast(`导入完成：${imported} 家`, 'success');
  } catch (err) {
    showToast(err.message || '导入失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '开始导入';
  }
}

// ── 日期格式化 ────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '未知';
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch { return dateStr; }
}

// ── 页面注册（同步执行，确保在 app.js DOMContentLoaded 之前注册）──────
registerPage('home',        { onEnter: loadRestaurants });
registerPage('restaurants', { onEnter: loadRestaurants });
registerPage('trash',       { onEnter: loadTrash });
registerPage('favorites',   { onEnter: loadFavorites });
registerPage('blacklist',   { onEnter: loadBlacklist });

// ── 页面初始化（事件绑定在 DOM 就绪后）──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTagChips();

  // 添加餐厅表单
  document.getElementById('add-restaurant-form')
    ?.addEventListener('submit', submitAddRestaurant);

  // 编辑面板
  document.getElementById('edit-restaurant-form')
    ?.addEventListener('submit', submitEditRestaurant);
  document.getElementById('btn-close-edit')
    ?.addEventListener('click', closeEditPanel);
  document.getElementById('edit-panel-overlay')
    ?.addEventListener('click', closeEditPanel);

  // 批量导入
  document.getElementById('btn-import-submit')
    ?.addEventListener('click', handleBatchImport);
  document.getElementById('btn-import-sample')
    ?.addEventListener('click', () => {
      const sample = [
        { name: '麦当劳', category: '快餐', tags: ['快手', '便宜'] },
        { name: '海底捞', category: '火锅', tags: ['辣', '重口'] },
        { name: '元气寿司', category: '日料', tags: ['清淡', '健康'] },
      ];
      document.getElementById('import-json-textarea').value = JSON.stringify(sample, null, 2);
    });
});
