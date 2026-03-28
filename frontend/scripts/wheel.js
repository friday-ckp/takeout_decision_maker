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
    const times = r.weight ?? (r.isFavorite ? 2 : 1);
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

  const n     = segments.length;
  const slice = (2 * Math.PI) / n;

  // 1. 先确定中奖扇区，再反推目标角度（而非从最终角度猜扇区）
  const winIdx = Math.floor(Math.random() * n);

  // 2. 让 winIdx 扇区的中心恰好落在指针（-π/2，12 点钟）处：
  //    R + winIdx*slice - π/2 + slice/2 = -π/2  =>  R = -(winIdx + 0.5)*slice
  const baseAngle  = -(winIdx + 0.5) * slice;

  // 3. 在 baseAngle 基础上加足够多的整圈，保证旋转圈数 >= 5
  const minSpins  = 5 + Math.random() * 5;
  const minTarget = currentAngle + minSpins * 2 * Math.PI;
  const k         = Math.ceil((minTarget - baseAngle) / (2 * Math.PI));
  const targetAngle = baseAngle + k * 2 * Math.PI;

  const duration  = (2 + Math.random() * 2) * 1000;
  const startAng  = currentAngle;
  let startTime   = null;   // 在首帧 rAF 回调中赋值，避免沙盒环境计时偏差

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function frame(now) {
    if (startTime === null) startTime = now;  // 首帧才开始计时
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    currentAngle   = startAng + easeOut(progress) * (targetAngle - startAng);
    drawWheel(canvas, segments, currentAngle);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      currentAngle = targetAngle;   // 确保精确落点
      isSpinning   = false;
      drawWheel(canvas, segments, currentAngle);
      highlightSector(canvas, segments, winIdx, currentAngle);
      setTimeout(() => onDone(segments[winIdx]), 600);
    }
  }
  requestAnimationFrame(frame);
}

// ── 重玩圆点指示器 ────────────────────────────────────────────────
function renderReplayDots(replayCount, maxReplay) {
  const container = document.getElementById('replay-dots');
  if (!container) return;
  const remaining = maxReplay - replayCount;
  if (remaining <= 0) {
    container.innerHTML = `<span class="replay-count-text replay-count-empty">今日次数已用完</span>`;
  } else {
    container.innerHTML = `<span class="replay-count-text">今日剩余 <strong>${remaining}</strong> 次</span>`;
  }
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
    if (hint) hint.textContent = '今日次数已用完，就它了！';
  } else {
    replayBtn.disabled = false;
    if (hint) hint.textContent = `今日剩余 ${remaining} 次`;
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
    // 确认即消耗 1 次今日决策次数
    await api.patch('/api/daily-config', { incrementReplay: true });
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

// ── 换一个（消耗 1 次今日次数）───────────────────────────────────
async function replayWheel() {
  try { await api.patch('/api/daily-config', { incrementReplay: true }); }
  catch (err) { showToast(err.message || '换一个失败', 'error'); return; }

  currentAngle = 0;
  isSpinning   = false;
  await loadDailyConfig();
  renderReplayDots(dailyConfig?.replayCount ?? 0, dailyConfig?.maxReplayCount ?? 3);
  navigate('wheel');
  requestAnimationFrame(() => {
    const canvas = document.getElementById('wheel-canvas');
    if (canvas) {
      drawWheel(canvas, wheelSegments, 0);
      setTimeout(triggerSpin, 300);
    }
  });
}

// ── 结果页重玩提示更新（供 minesweeper.js 调用）──────────────────
async function updateResultReplayHint() {
  await loadDailyConfig();
  const remaining = (dailyConfig?.maxReplayCount ?? 3) - (dailyConfig?.replayCount ?? 0);
  const replayBtn = document.getElementById('btn-result-replay');
  const hint      = document.getElementById('result-replay-hint');
  if (replayBtn) replayBtn.disabled = remaining <= 0;
  if (hint) hint.textContent = remaining <= 0 ? '今天的纠结次数已用完！' : `还可以换 ${remaining} 次`;
}

// ── 决策页 onEnter：检查今日次数是否耗尽 ─────────────────────────
async function enterDecidePage() {
  await loadDailyConfig();
  const replayCount    = dailyConfig?.replayCount    ?? 0;
  const maxReplayCount = dailyConfig?.maxReplayCount ?? 3;
  const exhausted      = replayCount >= maxReplayCount;

  const wheelCard = document.getElementById('btn-choose-wheel');
  const mineCard  = document.getElementById('btn-choose-mine');
  const notice    = document.getElementById('decide-exhausted-notice');

  if (wheelCard) wheelCard.classList.toggle('mode-card--disabled', exhausted);
  if (mineCard)  mineCard.classList.toggle('mode-card--disabled',  exhausted);

  // 禁用点击
  if (wheelCard) wheelCard.dataset.exhausted = exhausted ? '1' : '';
  if (mineCard)  mineCard.dataset.exhausted  = exhausted ? '1' : '';

  if (notice) {
    notice.style.display = exhausted
      ? 'block'
      : 'none';
  }
}

// ── 进入决策页 ────────────────────────────────────────────────────
async function enterDecideWheel() {
  try {
    const params = new URLSearchParams({ limit: '16' });
    if (typeof currentMood !== 'undefined' && currentMood) params.set('mood', currentMood);
    if (typeof currentFlavors !== 'undefined' && currentFlavors.length)
      params.set('flavors', currentFlavors.join(','));

    const data = await api.get(`/api/candidates?${params}`);
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

  // 先 navigate 让 canvas 出现在 DOM 可视区域，再通过 rAF 绘制
  navigate('wheel');
  renderWheelCandidateList(wheelSegments);
  requestAnimationFrame(() => {
    const canvas = document.getElementById('wheel-canvas');
    if (canvas) drawWheel(canvas, wheelSegments, 0);
  });
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
  registerPage('decide',       { onEnter: enterDecidePage });
  registerPage('wheel-select', {});
  registerPage('wheel',        {});
  registerPage('result',       {});

  // 首页「开始决策」
  document.getElementById('btn-start-decision')?.addEventListener('click', () => navigate('decide'));

  // 模式选择 → 转盘（耗尽则不响应）
  const wheelCard = document.getElementById('btn-choose-wheel');
  wheelCard?.addEventListener('click', () => {
    if (wheelCard.dataset.exhausted === '1') return;
    enterDecideWheel();
  });
  wheelCard?.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && wheelCard.dataset.exhausted !== '1') enterDecideWheel();
  });

  // 模式选择 → 扫雷（耗尽则不响应）
  const mineCard = document.getElementById('btn-choose-mine');
  mineCard?.addEventListener('click', () => {
    if (mineCard.dataset.exhausted === '1') return;
    navigate('mine');
  });
  mineCard?.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && mineCard.dataset.exhausted !== '1') navigate('mine');
  });

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
