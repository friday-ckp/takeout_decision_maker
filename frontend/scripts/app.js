/**
 * app.js — SPA 路由 & 全局工具
 */

const pages = {};

function registerPage(id, { onEnter } = {}) {
  pages[id] = { onEnter };
}

let currentPage = null;

function navigate(pageId) {
  if (currentPage === pageId) return;

  document.querySelectorAll('.app-page').forEach(el => el.classList.add('hidden'));

  const navPages = ['home','restaurants','history','settings'];
  document.querySelectorAll('.topnav__link').forEach(btn => {
    const active = navPages.includes(pageId) && btn.dataset.page === pageId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  const el = document.getElementById(`page-${pageId}`);
  if (el) el.classList.remove('hidden');

  currentPage = pageId;

  if (pages[pageId]?.onEnter) pages[pageId].onEnter();
}

// ── 侧边面板（添加餐厅）──────────────────────────────────────────
function openAddPanel() {
  document.getElementById('add-panel').classList.add('open');
  document.getElementById('add-panel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('add-name')?.focus(), 200);
}

function closeAddPanel() {
  document.getElementById('add-panel').classList.remove('open');
  document.getElementById('add-panel-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(message, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast${type ? ' toast-' + type : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ── 心情选择器 ────────────────────────────────────────────────────
let currentMood = '😊';
let currentMoodLabel = '开心';
let currentFlavors = [];  // Story 5.6 口味偏好

function setMood(emoji, label) {
  currentMood = emoji;
  currentMoodLabel = label;

  // 更新顶部 chip
  const navIcon = document.getElementById('nav-mood-icon');
  const navText = document.getElementById('nav-mood-text');
  if (navIcon) navIcon.textContent = emoji;
  if (navText) navText.textContent = label;

  // 更新首页心情格
  document.querySelectorAll('#home-mood-grid .mood-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.mood === emoji);
  });

  // 更新模式选择页副标题
  updateDecideSubtitle();

  // 同步到后端 daily-config
  api.patch('/api/daily-config', { mood: emoji }).catch(() => {});
}

function updateDecideSubtitle() {
  const sub = document.getElementById('decide-mood-sub');
  if (!sub) return;
  const flavorStr = currentFlavors.length ? `· 口味：${currentFlavors.join('、')}` : '';
  sub.textContent = `心情：${currentMood} ${currentMoodLabel} ${flavorStr}`;
}

function initMoodGrid() {
  document.querySelectorAll('#home-mood-grid .mood-card').forEach(card => {
    card.addEventListener('click', () => {
      setMood(card.dataset.mood, card.dataset.label);
    });
  });

  // 顶部心情 chip 点击 → 跳回首页设置心情
  document.getElementById('nav-mood-chip')?.addEventListener('click', () => {
    navigate('home');
  });
}

// ── 口味偏好选择器（Story 5.4/5.6）──────────────────────────────
function initFlavorChips() {
  const container = document.getElementById('decide-flavor-chips');
  if (!container) return;

  container.querySelectorAll('.chip[data-flavor]').forEach(chip => {
    chip.addEventListener('click', () => {
      const flavor = chip.dataset.flavor;
      if (currentFlavors.includes(flavor)) {
        currentFlavors = currentFlavors.filter(f => f !== flavor);
        chip.classList.remove('active');
      } else {
        currentFlavors.push(flavor);
        chip.classList.add('active');
      }
      updateDecideSubtitle();
    });
  });
}

// ── DOM Ready ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMoodGrid();
  initFlavorChips();

  // 顶部导航
  document.querySelectorAll('.topnav__link').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // 添加餐厅按钮
  ['btn-open-add','btn-add-restaurant','btn-goto-add','btn-home-goto-add']
    .forEach(id => document.getElementById(id)?.addEventListener('click', openAddPanel));

  // 关闭面板
  document.getElementById('btn-close-add')?.addEventListener('click', closeAddPanel);
  document.getElementById('add-panel-overlay')?.addEventListener('click', closeAddPanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAddPanel(); });

  // 面包屑导航
  document.getElementById('btn-back-home')?.addEventListener('click', () => navigate('home'));
  document.getElementById('btn-back-decide-from-select')?.addEventListener('click', () => navigate('decide'));
  document.getElementById('btn-back-decide-from-wheel')?.addEventListener('click', () => navigate('decide'));

  // 餐厅页内子页面导航
  document.getElementById('btn-goto-trash')?.addEventListener('click', () => navigate('trash'));
  document.getElementById('btn-goto-favorites')?.addEventListener('click', () => navigate('favorites'));
  document.getElementById('btn-goto-blacklist')?.addEventListener('click', () => navigate('blacklist'));

  document.getElementById('btn-back-restaurants-trash')?.addEventListener('click', () => navigate('restaurants'));
  document.getElementById('btn-back-restaurants-fav')?.addEventListener('click',   () => navigate('restaurants'));
  document.getElementById('btn-back-restaurants-black')?.addEventListener('click', () => navigate('restaurants'));

  // 批量导入
  document.getElementById('btn-goto-import')?.addEventListener('click', () => navigate('import'));
  document.getElementById('btn-back-restaurants-import')?.addEventListener('click', () => navigate('restaurants'));

  // 初始页
  navigate('home');
});
