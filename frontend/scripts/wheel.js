/**
 * wheel.js — 转盘决策完整逻辑
 * Stories: 2.3 / 2.4 / 2.5 / 2.6 / 2.7 / 2.8 / 2.9
 */

const SECTOR_COLORS = [
  '#fde8c0','#dde6ff','#fce7f3','#d1fae5',
  '#ffe4e6','#fef9c3','#e0f2fe','#f3e8ff',
  '#fff7ed','#ecfdf5','#fef2f2','#f0f9ff',
];

// ── 状态 ──────────────────────────────────────────────────────────
let rawCandidates = [];
let wheelSegments = [];
let selectedIds   = new Set();
let isSpinning    = false;
let currentAngle  = 0;
let selectedResult = null;
let dailyConfig    = null;

// ── 扇区构建（收藏2倍）────────────────────────────────────────────
function buildSegments(list) {
  const segs = [];
  list.forEach((r, idx) => {
    const color = SECTOR_COLORS[idx % SECTOR_COLORS.length];
    const times = r.isFavorite ? 2 : 1;
    for (let i = 0; i < times; i++) segs.push({ ...r, _color: color });
  });
  return segs;
}

// ── Canvas 渲染 ────────────────────────────────────────────────────
function drawWheel(canvas, segments, rotation = 0) {
  const ctx = canvas.getContext('2d');
  const sz  = canvas.width;
  const cx  = sz / 2, cy = sz / 2;
  const r   = sz / 2 - 3;
  const n   = segments.length;

  ctx.clearRect(0, 0, sz, sz);
  if (n === 0) return;

  const slice = (2 * Math.PI) / n;

  segments.forEach((seg, i) => {
    const sa = rotation + i * slice - Math.PI / 2;
    const ea = sa + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sa, ea);
    ctx.closePath();
    ctx.fillStyle = seg._color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 文字
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sa + slice / 2);
    ctx.textAlign = 'right';
    const fontSize = Math.max(11, Math.min(15, 180 / n));
    ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", sans-serif`;
    ctx.fillStyle = 'rgba(17,17,17,0.75)';
    const name = seg.name.length > 8 ? seg.name.slice(0, 7) + '…' : seg.name;
    ctx.fillText(name, r - 12, fontSize / 3);
    ctx.restore();
  });
}

// ── 高亮中奖扇区 ──────────────────────────────────────────────────
function highlightSector(canvas, segments, winIdx, rotation) {
  const ctx = canvas.getContext('2d');
  const sz  = canvas.width;
  const cx  = sz / 2, cy = sz / 2, r = sz / 2 - 3;
  const n   = segments.length;
  const slice = (2 * Math.PI) / n;

  segments.forEach((seg, i) => {
    const sa = rotation + i * slice - Math.PI / 2;
    const ea = sa + slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sa, ea);
    ctx.closePath();
    ctx.fillStyle = i === winIdx ? seg._color : seg._color + '55';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 中奖扇区描边
  const ws = rotation + winIdx * slice - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, ws, ws + slice);
  ctx.closePath();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.stroke();
}

// ── 旋转动画 ──────────────────────────────────────────────────────
function spinWheel(canvas, segments, onDone) {
  if (isSpinning || segments.length === 0) return;
  isSpinning = true;

  const totalRot  = 2 * Math.PI * (5 + Math.random() * 5);
  const duration  = (2 + Math.random() * 2) * 1000;
  const startAng  = currentAngle;
  const startTime = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function frame(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    currentAngle   = startAng + easeOut(progress) * totalRot;
    drawWheel(canvas, segments, currentAngle);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      isSpinning = false;

      const n = segments.length;
      const slice = (2 * Math.PI) / n;
      const norm  = ((-(currentAngle % (2 * Math.PI))) + 2 * Math.PI + Math.PI / 2) % (2 * Math.PI);
      const idx   = Math.floor(norm / slice) % n;

      highlightSector(canvas, segments, idx, currentAngle);
      setTimeout(() => onDone(segments[idx]), 600);
    }
  }
  requestAnimationFrame(frame);
}

// ── 重玩圆点指示器 ────────────────────────────────────────────────
function renderReplayDots(replayCount, maxReplay) {
  const container = document.getElementById('replay-dots');
  if (!container) return;
  const remaining = maxReplay - replayCount;
  container.innerHTML = Array.from({ length: maxReplay }, (_, i) =>
    `<div class="${i < remaining ? 'rdot-filled' : 'rdot-empty'}"></div>`
  ).join('');
}

// ── 候选列表（右侧卡片）──────────────────────────────────────────
function renderWheelCandidateList(segments) {
  const list  = document.getElementById('wheel-candidate-list');
  const label = document.getElementById('wheel-candidate-count-label');
  if (!list) return;

  // 去重展示（每家餐厅1行）
  const seen = new Set();
  const unique = segments.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id); return true;
  });

  if (label) label.textContent = `本次候选（${unique.length} 家）`;

  list.innerHTML = unique.map(seg => `
    <div class="candidate-item">
      <span class="dot" style="background:${seg._color}"></span>
      <span class="cname">${escapeHtml(seg.name)}</span>
      ${seg.isFavorite ? '<span class="star">⭐ ×2</span>' : '<span class="wt">×1</span>'}
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 勾选页 ────────────────────────────────────────────────────────
function renderSelectPage(candidates) {
  const list = document.getElementById('wheel-select-list');
  if (!list) return;

  list.innerHTML = candidates.map(r => `
    <div class="select-item checked" data-id="${r.id}">
      <div class="select-item__check">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="2,6 5,9 10,3"/>
        </svg>
      </div>
      <span class="select-item__name">${escapeHtml(r.name)}</span>
      ${r.isFavorite ? '<span class="select-item__fav">⭐ 收藏</span>' : ''}
      ${r.category ? `<span style="font-size:12px;color:#aaa">${escapeHtml(r.category)}</span>` : ''}
    </div>
  `).join('');

  selectedIds = new Set(candidates.map(r => r.id));
  updateSelectCount();

  list.querySelectorAll('.select-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id, 10);
      if (selectedIds.has(id)) { selectedIds.delete(id); item.classList.remove('checked'); }
      else { selectedIds.add(id); item.classList.add('checked'); }
      updateSelectCount();
    });
  });
}

function updateSelectCount() {
  const count = selectedIds.size;
  const el  = document.getElementById('wheel-select-count');
  const btn = document.getElementById('btn-wheel-select-confirm');
  if (el) el.textContent = count;
  if (btn) { btn.disabled = count < 2; btn.title = count < 2 ? '至少选2家餐厅' : ''; }
}

// ── 每日配置 ──────────────────────────────────────────────────────
async function loadDailyConfig() {
  try {
    dailyConfig = await api.get('/api/daily-config');
  } catch {
    dailyConfig = { replayCount: 0, maxReplayCount: 3 };
  }
}

// ── 结果页 ────────────────────────────────────────────────────────
async function showResult(restaurant) {
  selectedResult = restaurant;
  await loadDailyConfig();

  document.getElementById('result-name').textContent     = restaurant.name;
  document.getElementById('result-category').textContent = restaurant.category ? `分类：${restaurant.category}` : '';
  document.getElementById('result-notes').textContent    = restaurant.notes || '';

  const remaining = (dailyConfig?.maxReplayCount ?? 3) - (dailyConfig?.replayCount ?? 0);
  const replayBtn = document.getElementById('btn-result-replay');
  const hint      = document.getElementById('result-replay-hint');

  if (remaining <= 0) {
    replayBtn.disabled = true;
    if (hint) hint.textContent = '今天的纠结次数已用完，就它了！';
  } else {
    replayBtn.disabled = false;
    if (hint) hint.textContent = `还可以换 ${remaining} 次`;
  }

  navigate('result');
}

// ── 确认结果 ──────────────────────────────────────────────────────
async function confirmResult() {
  const btn = document.getElementById('btn-result-confirm');
  if (!btn || !selectedResult) return;

  btn.disabled = true;
  btn.textContent = '记录中…';

  try {
    await api.post('/api/history', { restaurantId: selectedResult.id, mode: 'wheel' });
    showToast('已记录，今天就吃这家！', 'success');
    navigate('home');
  } catch (err) {
    showToast(err.message || '记录失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '就这家了！';
  }
}

// ── 换一个 ────────────────────────────────────────────────────────
async function replayWheel() {
  try { await api.patch('/api/daily-config', { incrementReplay: true }); }
  catch (err) { showToast(err.message || '换一个失败', 'error'); return; }
  navigate('wheel');
  setTimeout(triggerSpin, 300);
}

// ── 进入决策页 ────────────────────────────────────────────────────
async function enterDecideWheel() {
  try {
    const data = await api.get('/api/candidates?limit=16');
    rawCandidates = data.candidates || [];

    if (rawCandidates.length === 0) {
      showToast('没有可参与的餐厅', 'error'); return;
    }

    if (data.sampledDown) {
      renderSelectPage(rawCandidates);
      navigate('wheel-select');
    } else {
      startWheelWithCandidates(rawCandidates);
    }
  } catch (err) {
    showToast('加载候选失败：' + err.message, 'error');
  }
}

// ── 初始化转盘页 ──────────────────────────────────────────────────
async function startWheelWithCandidates(candidates) {
  wheelSegments = buildSegments(candidates);
  currentAngle  = 0;
  isSpinning    = false;

  await loadDailyConfig();
  renderReplayDots(dailyConfig?.replayCount ?? 0, dailyConfig?.maxReplayCount ?? 3);

  const canvas = document.getElementById('wheel-canvas');
  drawWheel(canvas, wheelSegments, 0);
  renderWheelCandidateList(wheelSegments);

  navigate('wheel');
}

function triggerSpin() {
  const canvas   = document.getElementById('wheel-canvas');
  const spinBtn  = document.getElementById('btn-wheel-spin');
  const hub      = document.getElementById('wheel-hub');

  if (!canvas || isSpinning) return;

  if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = '旋转中…'; }
  if (hub)     { hub.textContent = '⏳'; hub.style.pointerEvents = 'none'; }

  spinWheel(canvas, wheelSegments, (winner) => {
    if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = '开始旋转 ▶'; }
    if (hub)     { hub.textContent = '▶'; hub.style.pointerEvents = ''; }
    showResult(winner);
  });
}

// ── 快速添加 ──────────────────────────────────────────────────────
async function quickAdd() {
  const input = document.getElementById('quick-add-input');
  const name  = input?.value?.trim();
  if (!name) { input?.focus(); return; }

  try {
    await api.post('/api/restaurants', { name, category: '', tags: [], notes: '' });
    input.value = '';
    showToast(`"${name}" 已添加`, 'success');

    // 重新加载候选
    const data = await api.get('/api/candidates?limit=16');
    rawCandidates = data.candidates || [];
    wheelSegments = buildSegments(rawCandidates);
    const canvas = document.getElementById('wheel-canvas');
    drawWheel(canvas, wheelSegments, currentAngle);
    renderWheelCandidateList(wheelSegments);
  } catch (err) {
    showToast(err.message || '添加失败', 'error');
  }
}

// ── DOM Ready ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  registerPage('decide',       {});
  registerPage('wheel-select', {});
  registerPage('wheel',        {});
  registerPage('result',       {});

  // 首页「开始决策」
  document.getElementById('btn-start-decision')?.addEventListener('click', () => navigate('decide'));

  // 模式选择 → 转盘
  const wheelCard = document.getElementById('btn-choose-wheel');
  wheelCard?.addEventListener('click', enterDecideWheel);
  wheelCard?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') enterDecideWheel(); });

  // 勾选页确认
  document.getElementById('btn-wheel-select-confirm')?.addEventListener('click', () => {
    startWheelWithCandidates(rawCandidates.filter(r => selectedIds.has(r.id)));
  });

  // 转盘旋转（按钮 + hub 双入口）
  document.getElementById('btn-wheel-spin')?.addEventListener('click', triggerSpin);
  document.getElementById('wheel-hub')?.addEventListener('click', triggerSpin);

  // 快速添加
  document.getElementById('btn-quick-add')?.addEventListener('click', quickAdd);
  document.getElementById('quick-add-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') quickAdd();
  });

  // 结果页按钮
  document.getElementById('btn-result-confirm')?.addEventListener('click', confirmResult);
  document.getElementById('btn-result-replay')?.addEventListener('click', replayWheel);
});
