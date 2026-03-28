/**
 * minesweeper.js — Story 3.2/3.3/3.4 扫雷模式前端
 */

let mineCells    = [];
let mineRevealed = false;
let mineFoundCell = null;

function escapeMine(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 渲染扫雷格子
function renderMineGrid(cells) {
  const grid = document.getElementById('mine-grid');
  if (!grid) return;
  mineCells = cells;
  mineRevealed = false;

  grid.innerHTML = cells.map((cell, idx) => `
    <div class="mine-cell${cell.isMine ? ' is-mine' : ''}" data-idx="${idx}">
      <div class="mine-cell__inner">
        <div class="mine-cell__back">❓</div>
        <div class="mine-cell__front">
          ${cell.isMine
            ? '<span style="font-size:32px">💣</span>'
            : `<div class="mine-cell__name">${escapeMine(cell.name)}</div>
               ${cell.category ? `<div class="mine-cell__cat">${escapeMine(cell.category)}</div>` : ''}
               ${cell.isFavorite ? '<div class="mine-cell__fav">❤</div>' : ''}`}
        </div>
      </div>
    </div>
  `).join('');

  grid.onclick = (e) => {
    if (mineRevealed) return;
    const cellEl = e.target.closest('.mine-cell');
    if (!cellEl) return;
    const idx = parseInt(cellEl.dataset.idx, 10);
    revealMineCell(idx, cellEl);
  };
}

function revealMineCell(idx, cellEl) {
  const cell = mineCells[idx];
  if (cellEl.classList.contains('revealed')) return;

  cellEl.classList.add('revealed');

  if (cell.isMine) {
    // 翻到雷 → 震动提示，继续翻
    cellEl.classList.add('boom');
    showToast('💣 是雷！再翻一个…', 'error');
    return;
  }

  // 翻到餐厅 → 展示结果弹窗
  mineRevealed = true;
  setTimeout(() => showMineResult(cell), 600);
}

// 显示扫雷结果弹窗（不跳转页面，直接在格子上弹出）
async function showMineResult(cell) {
  mineFoundCell = cell;

  document.getElementById('mine-result-name').textContent     = cell.name;
  document.getElementById('mine-result-category').textContent = cell.category || '';

  // 获取重玩次数
  let cfg;
  try { cfg = await api.get('/api/daily-config'); }
  catch { cfg = { replayCount: 0, maxReplayCount: 3 }; }

  const remaining = (cfg.maxReplayCount ?? 3) - (cfg.replayCount ?? 0);
  const replayBtn = document.getElementById('btn-mine-replay');
  const hint      = document.getElementById('mine-result-hint');

  if (replayBtn) replayBtn.disabled = remaining <= 0;
  if (hint) hint.textContent = remaining <= 0 ? '今天的纠结次数已用完！' : `还可以换 ${remaining} 次`;

  document.getElementById('mine-result-overlay').classList.remove('hidden');
}

// 确认结果：记录历史，回首页
async function confirmMineResult() {
  const btn = document.getElementById('btn-mine-confirm');
  if (!btn || !mineFoundCell) return;

  btn.disabled = true;
  btn.textContent = '记录中…';

  try {
    await api.post('/api/history', { restaurantId: mineFoundCell.id, mode: 'minesweeper' });
    showToast('已记录，今天就吃这家！', 'success');
    document.getElementById('mine-result-overlay').classList.add('hidden');
    navigate('home');
  } catch (err) {
    showToast(err.message || '记录失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '就这家了！';
  }
}

// 换一个：消耗次数 + 重新洗牌
async function replayMine() {
  try {
    await api.patch('/api/daily-config', { incrementReplay: true });
  } catch (err) {
    showToast(err.message || '换一个失败', 'error');
    return;
  }
  document.getElementById('mine-result-overlay').classList.add('hidden');
  mineFoundCell = null;
  loadMineGrid();
}

// 加载扫雷候选
async function loadMineGrid() {
  const grid = document.getElementById('mine-grid');
  if (!grid) return;

  // 关闭可能残留的弹窗
  document.getElementById('mine-result-overlay')?.classList.add('hidden');
  mineFoundCell = null;

  grid.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:40px">加载候选中…</p>';

  try {
    const mood    = typeof currentMood !== 'undefined' ? currentMood : null;
    const flavors = typeof currentFlavors !== 'undefined' && currentFlavors.length
      ? currentFlavors.join(',') : '';

    const params = new URLSearchParams();
    if (mood)    params.set('mood', mood);
    if (flavors) params.set('flavors', flavors);

    const data = await api.get(`/api/candidates/mine?${params}`);
    const cells = data.cells || [];

    if (cells.length === 0) {
      grid.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:40px">候选餐厅不足，无法开始扫雷</p>';
      return;
    }

    renderMineGrid(cells);
  } catch (err) {
    grid.innerHTML = `<p style="color:#ef4444;font-size:13px;text-align:center">${err.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  registerPage('mine', { onEnter: loadMineGrid });

  // 返回模式选择
  document.getElementById('btn-back-decide-from-mine')
    ?.addEventListener('click', () => navigate('decide'));

  // 重新洗牌
  document.getElementById('btn-mine-reshuffle')
    ?.addEventListener('click', loadMineGrid);

  // 结果弹窗按钮
  document.getElementById('btn-mine-confirm')
    ?.addEventListener('click', confirmMineResult);
  document.getElementById('btn-mine-replay')
    ?.addEventListener('click', replayMine);
});
