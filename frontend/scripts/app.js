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
  document.querySelectorAll('.topnav__link').forEach(btn => {
    const isNav = ['home','restaurants','history','settings'].includes(pageId);
    const active = isNav && btn.dataset.page === pageId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  const el = document.getElementById(`page-${pageId}`);
  if (el) el.classList.remove('hidden');

  currentPage = pageId;

  if (pages[pageId]?.onEnter) pages[pageId].onEnter();
}

// ── 侧边面板 ──────────────────────────────────────────────────────
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
  const sub = document.getElementById('decide-mood-sub');
  if (sub) sub.textContent = `心情：${emoji} ${label} · 显示全部候选餐厅`;
}

function initMoodGrid() {
  document.querySelectorAll('#home-mood-grid .mood-card').forEach(card => {
    card.addEventListener('click', () => {
      setMood(card.dataset.mood, card.dataset.label);
    });
  });
}

// ── DOM Ready ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMoodGrid();

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

  // 初始页
  navigate('home');
});
