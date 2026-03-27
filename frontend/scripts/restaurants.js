/**
 * restaurants.js — 餐厅列表 & 添加逻辑
 */

let restaurantList = [];

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

  if (emptyEl)  emptyEl.classList.add('hidden');
  if (countEl)  countEl.textContent = `共 ${list.length} 家餐厅`;

  container.innerHTML = list.map(r => `
    <div class="restaurant-card" data-id="${r.id}">
      <div class="restaurant-card__header">
        <span class="restaurant-card__name">${escapeHtml(r.name)}</span>
        <button class="fav-btn${r.isFavorite ? ' active' : ''}" data-id="${r.id}"
                aria-label="${r.isFavorite ? '取消收藏' : '收藏'}">
          <svg viewBox="0 0 24 24" fill="${r.isFavorite ? 'currentColor' : 'none'}"
               stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      ${r.category ? `<span class="restaurant-card__category">${escapeHtml(r.category)}</span>` : ''}
      ${r.tags && r.tags.length ? `
        <div class="restaurant-card__tags">
          ${r.tags.map(t => `<span class="chip" style="cursor:default">${escapeHtml(t)}</span>`).join('')}
        </div>` : ''}
      ${r.notes ? `<p class="restaurant-card__notes">${escapeHtml(r.notes)}</p>` : ''}
    </div>
  `).join('');
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
    // DB 未连接时静默处理，不显示 toast（避免首次加载报错烦人）
    console.warn('API 不可用:', err.message);
  }
}

// ── 更新右侧统计卡片 ──────────────────────────────────────────────
function updateStats(list) {
  const total    = list.length;
  const favorite = list.filter(r => r.isFavorite).length;

  const statTotal    = document.getElementById('stat-total');
  const statFavorite = document.getElementById('stat-favorite');
  const statHistory  = document.getElementById('stat-history');

  if (statTotal)    statTotal.textContent    = total;
  if (statFavorite) statFavorite.textContent = favorite;
  if (statHistory)  statHistory.textContent  = '—';  // Sprint 2 历史功能
}

// ── 首页「开始决策」按钮状态 ──────────────────────────────────────
function updateHomeDecisionButton(count) {
  const btn     = document.getElementById('btn-start-decision');
  const hint    = document.getElementById('home-empty-hint');
  const loading = document.getElementById('home-loading-hint');
  const addBtn  = document.getElementById('btn-home-goto-add');

  if (loading) loading.classList.add('hidden');
  if (!btn) return;

  if (count === 0) {
    btn.disabled = true;
    if (hint)   { hint.textContent = '还没有餐厅，添加后才能开始决策'; hint.classList.remove('hidden'); }
    if (addBtn) addBtn.classList.remove('hidden');
  } else if (count < 2) {
    btn.disabled = true;
    if (hint)   { hint.textContent = '至少需要2家餐厅才能开始决策'; hint.classList.remove('hidden'); }
    if (addBtn) addBtn.classList.remove('hidden');
  } else {
    btn.disabled = false;
    if (hint)   hint.classList.add('hidden');
    if (addBtn) addBtn.classList.add('hidden');
  }
}

// ── 标签选择 ──────────────────────────────────────────────────────
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

    // 如果在首页，切到餐厅页看结果
    if (currentPage === 'home') navigate('restaurants');
  } catch (err) {
    showToast(err.message || '添加失败', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '保存';
  }
}

// ── 页面注册 & 初始化 ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTagChips();

  registerPage('home',        { onEnter: loadRestaurants });
  registerPage('restaurants', { onEnter: loadRestaurants });

  document.getElementById('add-restaurant-form')
    ?.addEventListener('submit', submitAddRestaurant);
});
