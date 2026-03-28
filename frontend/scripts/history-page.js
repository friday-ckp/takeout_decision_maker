/**
 * history-page.js — Story 5.1 历史记录页前端
 */

let historyPage = 1;
let historyTotal = 0;
const HISTORY_PAGE_SIZE = 20;

function escapeHistoryHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatHistoryDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs  = now - d;
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffDay === 0) return '今天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diffDay === 1) return '昨天';
    if (diffDay < 7)  return `${diffDay}天前`;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch { return dateStr; }
}

function modeLabel(mode) {
  return mode === 'minesweeper' ? '💣 扫雷' : '🎡 转盘';
}

async function loadHistory(page = 1) {
  historyPage = page;
  const container = document.getElementById('history-list-container');
  const pagerEl   = document.getElementById('history-pager');
  if (!container) return;

  container.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:24px">加载中…</p>';

  try {
    const data = await api.get(`/api/history?page=${page}&limit=${HISTORY_PAGE_SIZE}`);
    historyTotal = data.total || 0;
    const list = data.list || [];

    // 更新首页"最近一次"
    if (list.length > 0) {
      const statLast = document.getElementById('stat-last');
      if (statLast) statLast.textContent = list[0].restaurantName || '—';
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="history-empty"><p style="font-size:32px;margin-bottom:12px">🕐</p><p style="color:#aaa">还没有决策记录</p></div>';
      if (pagerEl) pagerEl.innerHTML = '';
      return;
    }

    container.innerHTML = list.map(h => `
      <div class="history-item">
        <div class="history-item__left">
          <span class="history-item__mode">${modeLabel(h.mode)}</span>
          <span class="history-item__name">${escapeHistoryHtml(h.restaurantName)}</span>
        </div>
        <span class="history-item__date">${formatHistoryDate(h.decidedAt)}</span>
      </div>
    `).join('');

    // 分页
    const totalPages = Math.ceil(historyTotal / HISTORY_PAGE_SIZE);
    if (pagerEl && totalPages > 1) {
      pagerEl.innerHTML = `
        <div class="history-pager">
          <button class="btn btn-secondary btn-sm" id="history-prev" ${page <= 1 ? 'disabled' : ''}>← 上一页</button>
          <span style="font-size:13px;color:#888">第 ${page} / ${totalPages} 页，共 ${historyTotal} 条</span>
          <button class="btn btn-secondary btn-sm" id="history-next" ${page >= totalPages ? 'disabled' : ''}>下一页 →</button>
        </div>
      `;
      document.getElementById('history-prev')
        ?.addEventListener('click', () => loadHistory(page - 1));
      document.getElementById('history-next')
        ?.addEventListener('click', () => loadHistory(page + 1));
    } else if (pagerEl) {
      pagerEl.innerHTML = `<p style="font-size:12px;color:#aaa;text-align:center;padding-top:8px">共 ${historyTotal} 条记录</p>`;
    }
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;font-size:13px;text-align:center">${err.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  registerPage('history', { onEnter: () => loadHistory(1) });
});
