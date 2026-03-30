/**
 * session.js — 多人实时协作决策
 * Stories: 6.3 / 6.5 / 6.6 / 6.7 / 6.8 / 6.9 / 6.10 / 6.11 / 6.12
 */

// ── 安全工具：HTML 实体转义（防 XSS）────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 会话状态 ──────────────────────────────────────────────────────
let sessionToken = null;
let sessionMode = null;        // 'wheel' | 'minesweeper'
let sessionUserId = null;
let sessionNickname = null;
let isHost = false;
let candidateSnapshot = [];    // 展开后的候选数组
let currentResult = null;      // { resultRestaurantId, resultRestaurantName }
let remainingReplays = 3;

// 多人转盘投票状态
let mpSpinCountdownTimer = null;
let mpSpinTotalParticipants = 0;
let mpSpinHasVoted = false;

// WebSocket 实例（Story 6.12 断线重连）
let ws = null;
let wsReconnectTimer = null;
let wsReconnectDelay = 1000;
const WS_MAX_DELAY = 5000;

// ── 多人模式选择弹窗（Story 6.3）─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const overlay    = document.getElementById('multi-mode-overlay');
  const btnClose   = document.getElementById('btn-close-multi-mode');
  const btnWheel   = document.getElementById('btn-multi-wheel');
  const btnMine    = document.getElementById('btn-multi-mine');
  const btnInvite  = document.getElementById('btn-invite-friends');

  // 点击「邀请朋友一起选」→ 打开模式弹窗
  btnInvite?.addEventListener('click', () => {
    overlay?.classList.remove('hidden');
  });
  btnClose?.addEventListener('click', () => overlay?.classList.add('hidden'));
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  // 选择模式后创建会话
  btnWheel?.addEventListener('click', () => createAndGoLobby('wheel'));
  btnMine?.addEventListener('click',  () => createAndGoLobby('minesweeper'));

  // lobby 页按钮
  document.getElementById('btn-lobby-join')?.addEventListener('click', handleLobbyJoin);
  document.getElementById('btn-copy-link')?.addEventListener('click', copyShareLink);
  document.getElementById('btn-lobby-start')?.addEventListener('click', handleLobbyStart);
  document.getElementById('btn-back-from-lobby')?.addEventListener('click', () => {
    wsClose();
    navigate('decide');
  });

  // 多人转盘旋转（所有人均可触发，Story 6.9-V2）
  document.getElementById('btn-mp-wheel-spin')?.addEventListener('click', handleMpWheelSpinVote);

  // 结果页操作
  document.getElementById('btn-sr-confirm')?.addEventListener('click', handleConfirm);
  document.getElementById('btn-sr-replay')?.addEventListener('click',  handleReplay);
  document.getElementById('btn-done-home')?.addEventListener('click',  () => navigate('home'));

  // 注册 SPA 路由页面
  registerPage('lobby',          { onEnter: onEnterLobby });
  registerPage('multiplayer',    { onEnter: onEnterMultiplayer });
  registerPage('session-result', { onEnter: () => {} });
  registerPage('session-done',   { onEnter: () => {} });

  // URL 路由：处理分享链接 /session/:token/lobby
  checkUrlRoute();
});

// ── URL 路由检测（Story 6.5）─────────────────────────────────────
function checkUrlRoute() {
  const path = window.location.pathname;
  const m = path.match(/\/session\/([^/]+)\/lobby/);
  if (m) {
    const token = m[1];
    // 检查 sessionStorage 是否有已保存的身份
    const saved = sessionStorage.getItem(`session_${token}`);
    if (saved) {
      try {
        const info = JSON.parse(saved);
        sessionToken   = token;
        sessionUserId  = info.userId;
        sessionNickname = info.nickname;
        isHost         = false;
        navigate('lobby');
      } catch (_) {
        // 信息异常，进入加入流程
        initJoinFlow(token);
      }
    } else {
      initJoinFlow(token);
    }
  }
}

// ── 创建会话并跳转 Lobby（Story 6.3）─────────────────────────────
async function createAndGoLobby(mode) {
  document.getElementById('multi-mode-overlay')?.classList.add('hidden');

  try {
    const data = await api.post('/api/sessions', { mode });
    sessionToken    = data.shareToken;
    sessionMode     = mode;
    sessionUserId   = 1;
    sessionNickname = '我（发起人）';
    isHost          = true;

    // 设置分享链接
    const baseUrl = window.location.origin;
    const shareLink = `${baseUrl}/session/${sessionToken}/lobby`;
    const linkEl = document.getElementById('lobby-share-link');
    if (linkEl) linkEl.value = shareLink;

    navigate('lobby');
  } catch (e) {
    showToast(e.message || '创建会话失败，请重试', 'error');
  }
}

// ── 进入加入流程（受邀者）─────────────────────────────────────────
function initJoinFlow(token) {
  sessionToken = token;
  isHost = false;
  document.getElementById('lobby-title').textContent = '加入决策会话';
  navigate('lobby');
}

// ── onEnterLobby ──────────────────────────────────────────────────
function onEnterLobby() {
  if (isHost) {
    // 发起人：直接显示等待室 + 分享链接
    showLobbyRoom();
    connectWs();
  } else if (sessionUserId) {
    // 已有身份（重连）
    showLobbyRoom();
    connectWs();
  } else {
    // 受邀者尚未输入昵称
    document.getElementById('lobby-join-section')?.classList.remove('hidden');
    document.getElementById('lobby-room-section')?.classList.add('hidden');
  }
}

function showLobbyRoom() {
  document.getElementById('lobby-join-section')?.classList.add('hidden');
  document.getElementById('lobby-room-section')?.classList.remove('hidden');

  if (isHost) {
    document.getElementById('lobby-share-section')?.classList.remove('hidden');
    document.getElementById('btn-lobby-start')?.classList.remove('hidden');
    document.getElementById('lobby-waiting-hint')?.classList.add('hidden');
  } else {
    document.getElementById('lobby-share-section')?.classList.add('hidden');
    document.getElementById('btn-lobby-start')?.classList.add('hidden');
    document.getElementById('lobby-waiting-hint')?.classList.remove('hidden');
  }
}

// ── 受邀者加入（Story 6.5/6.4）───────────────────────────────────
async function handleLobbyJoin() {
  const input = document.getElementById('lobby-nickname-input');
  const err   = document.getElementById('lobby-nickname-error');
  const nick  = input?.value.trim();

  err?.classList.add('hidden');
  if (!nick) {
    err.textContent = '请输入昵称';
    err.classList.remove('hidden');
    return;
  }
  if (nick.length > 20) {
    err.textContent = '昵称最长20字';
    err.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-lobby-join');
  btn.disabled = true;
  btn.textContent = '加入中…';

  try {
    const data = await api.post(`/api/sessions/${sessionToken}/join`, { nickname: nick });
    sessionUserId  = data.userId;
    sessionNickname = nick;
    // 保存到 sessionStorage 以便刷新后重连
    sessionStorage.setItem(`session_${sessionToken}`, JSON.stringify({ userId: sessionUserId, nickname: nick }));

    showLobbyRoom();
    connectWs();
  } catch (e) {
    err.textContent = e.message || '加入失败，请重试';
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '加入决策';
  }
}

// ── 复制分享链接（Story 6.3）─────────────────────────────────────
function copyShareLink() {
  const link = document.getElementById('lobby-share-link')?.value;
  if (!link) return;
  navigator.clipboard?.writeText(link)
    .then(() => showToast('链接已复制'))
    .catch(() => {
      // fallback
      const el = document.getElementById('lobby-share-link');
      el?.select();
      document.execCommand('copy');
      showToast('链接已复制');
    });
}

// ── 发起人开始决策（Story 6.8）───────────────────────────────────
async function handleLobbyStart() {
  const btn = document.getElementById('btn-lobby-start');
  btn.disabled = true;
  try {
    await api.post(`/api/sessions/${sessionToken}/start`, {});
    // WS 广播 deciding_started → 所有端跳转
  } catch (e) {
    showToast(e.message || '开始失败', 'error');
    btn.disabled = false;
  }
}

// ── WebSocket 连接（Story 6.12 断线重连）────────────────────────
function connectWs() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  clearTimeout(wsReconnectTimer);

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws/sessions?token=${sessionToken}&userId=${sessionUserId || ''}&nickname=${encodeURIComponent(sessionNickname || '')}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    wsReconnectDelay = 1000;
    hideReconnectHint();
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (_) { return; }
    handleWsMessage(msg);
  };

  ws.onclose = () => {
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };
}

function wsClose() {
  clearTimeout(wsReconnectTimer);
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}

function scheduleReconnect() {
  // 只有在 lobby / multiplayer / session-result 页面才重连
  const activePages = ['lobby', 'multiplayer', 'session-result'];
  if (!activePages.includes(currentPage)) return;

  showReconnectHint();
  wsReconnectTimer = setTimeout(() => {
    connectWs();
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, WS_MAX_DELAY);
  }, wsReconnectDelay);
}

function showReconnectHint() {
  document.getElementById('lobby-reconnect-hint')?.classList.remove('hidden');
  document.getElementById('mp-reconnect-hint')?.classList.remove('hidden');
}

function hideReconnectHint() {
  document.getElementById('lobby-reconnect-hint')?.classList.add('hidden');
  document.getElementById('mp-reconnect-hint')?.classList.add('hidden');
}

// ── 处理 WS 事件 ─────────────────────────────────────────────────
function handleWsMessage(msg) {
  const { event, data } = msg;

  switch (event) {
    case 'session_state':
      onSessionState(data);
      break;
    case 'participant_joined':
      onParticipantJoined(data);
      break;
    case 'deciding_started':
      onDecidingStarted(data);
      break;
    case 'result_revealed':
      onResultRevealed(data);
      break;
    case 'spin_progress':
      onSpinProgress(data);
      break;
    case 'round_result':
      onRoundResult(data);
      break;
    case 'tie_break_start':
      onTieBreakStart(data);
      break;
    case 'no_result':
      onNoResult(data);
      break;
    case 'session_done':
      onSessionDone(data);
      break;
    case 'replay_initiated':
      onReplayInitiated(data);
      break;
    case 'error':
      showToast(data?.message || '会话错误', 'error');
      break;
    default:
      break;
  }
}

// ── session_state：初始状态同步 ────────────────────────────────────
function onSessionState(data) {
  sessionMode = data.mode || sessionMode;
  candidateSnapshot = data.candidateSnapshot || [];

  renderParticipants(data.participants || []);

  if (data.status === 'deciding' || data.status === 'deciding_locked') {
    // 重连后恢复至决策页
    onDecidingStarted(data);
  }
}

// ── participant_joined：新成员加入 ────────────────────────────────
function onParticipantJoined(data) {
  const { nickname, totalCount } = data;
  appendParticipant({ nickname });
  updateStartButton(totalCount);
  const countEl = document.getElementById('lobby-participant-count');
  if (countEl) countEl.textContent = `参与者（${totalCount} 人）`;
}

// ── deciding_started：所有人跳转决策页 ────────────────────────────
function onDecidingStarted(data) {
  sessionMode = data.mode || sessionMode;
  candidateSnapshot = data.candidateSnapshot || candidateSnapshot;
  navigate('multiplayer');
}

// ── result_revealed：结果揭晓（扫雷模式使用；转盘模式走 round_result）──
function onResultRevealed(data) {
  currentResult = {
    resultRestaurantId:   data.resultRestaurantId,
    resultRestaurantName: data.resultRestaurantName,
  };

  // 扫雷：揭晓格子（Story 6.10）
  if (sessionMode === 'minesweeper') {
    revealMpMineCell(data);
  }
}

// ── session_done ──────────────────────────────────────────────────
function onSessionDone(data) {
  document.getElementById('done-restaurant-name').textContent = data.resultRestaurantName || '';
  navigate('session-done');
  wsClose();
}

// ── replay_initiated：重玩 ────────────────────────────────────────
function onReplayInitiated(data) {
  remainingReplays = data.remainingReplays;
  _stopMpCountdown();
  navigate('multiplayer');
  // 重置多人决策界面
  if (sessionMode === 'wheel') {
    resetMpWheel();
  } else {
    resetMpMine();
  }
}

// ── 渲染参与者列表 ─────────────────────────────────────────────────
function renderParticipants(participants) {
  const list = document.getElementById('lobby-participants-list');
  if (!list) return;
  list.innerHTML = '';
  participants.forEach(p => appendParticipant(p, list));
  updateStartButton(participants.length);
  const countEl = document.getElementById('lobby-participant-count');
  if (countEl) countEl.textContent = `参与者（${participants.length} 人）`;
}

function appendParticipant(p, container) {
  const list = container || document.getElementById('lobby-participants-list');
  if (!list) return;

  // 避免重复
  if (list.querySelector(`[data-nickname="${CSS.escape(p.nickname)}"]`)) return;

  const item = document.createElement('div');
  item.className = 'participant-item';
  item.dataset.nickname = p.nickname;
  // C1: escapeHtml 防止 nickname 含 HTML 特殊字符导致 XSS
  item.innerHTML = `
    <div class="p-avatar">${escapeHtml(p.nickname.charAt(0).toUpperCase())}</div>
    <div class="p-name">${escapeHtml(p.nickname)}</div>
    ${p.role === 'host' ? '<span class="p-badge">发起人</span>' : ''}
  `;
  list.appendChild(item);
}

function updateStartButton(count) {
  const btn = document.getElementById('btn-lobby-start');
  const countEl = document.getElementById('lobby-start-count');
  if (!btn) return;
  if (countEl) countEl.textContent = count;
  // 至少2人才能开始（含发起人）
  btn.disabled = count < 2;

  const hintEl = document.getElementById('lobby-min-players-hint');
  if (hintEl) {
    hintEl.classList.toggle('hidden', count >= 2);
  }
}

// ── onEnterMultiplayer ─────────────────────────────────────────────
function onEnterMultiplayer() {
  document.getElementById('mp-page-title').textContent =
    sessionMode === 'wheel' ? '🎡 多人转盘' : '💣 多人扫雷';

  // 渲染参与者 bar（简版）
  renderMpParticipantsBar();

  if (sessionMode === 'wheel') {
    document.getElementById('mp-wheel-area')?.classList.remove('hidden');
    document.getElementById('mp-mine-area')?.classList.add('hidden');
    initMpWheel();
  } else {
    document.getElementById('mp-wheel-area')?.classList.add('hidden');
    document.getElementById('mp-mine-area')?.classList.remove('hidden');
    initMpMine();
  }

  // 确保 WS 已连接
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWs();
  }
}

function renderMpParticipantsBar() {
  const bar = document.getElementById('mp-participants-bar');
  if (!bar) return;
  bar.innerHTML = '';
  // 从 lobby 参与者列表获取
  const items = document.querySelectorAll('#lobby-participants-list .participant-item');
  items.forEach(item => {
    const chip = document.createElement('div');
    chip.style.cssText = 'padding:4px 12px;background:#e0e7ff;border-radius:999px;font-size:13px;color:#4f46e5;font-weight:600';
    chip.textContent = item.dataset.nickname || '';
    bar.appendChild(chip);
  });
}

// ── 多人转盘（Story 6.9-V2：随机投票机制）───────────────────────
function initMpWheel() {
  const canvas = document.getElementById('mp-wheel-canvas');
  if (!canvas || candidateSnapshot.length === 0) return;
  drawMpWheel(canvas, candidateSnapshot);

  mpSpinHasVoted = false;
  const btn = document.getElementById('btn-mp-wheel-spin');
  const label = document.getElementById('mp-spin-label');
  btn.disabled = false;
  if (label) label.textContent = '转！';

  // 隐藏上次的提示横幅
  document.getElementById('mp-tie-banner')?.classList.add('hidden');
  document.getElementById('mp-no-result-banner')?.classList.add('hidden');

  // 获取参与人数：从 lobby 参与者列表计算
  const items = document.querySelectorAll('#lobby-participants-list .participant-item');
  mpSpinTotalParticipants = items.length || 1;

  // 更新进度文字
  const progressEl = document.getElementById('mp-spin-progress-text');
  if (progressEl) progressEl.textContent = `0/${mpSpinTotalParticipants} 人已转`;

  // 启动本地 30s 倒计时（与服务端超时同步）
  _startMpCountdown(30);
}

function _startMpCountdown(seconds) {
  clearInterval(mpSpinCountdownTimer);
  let remaining = seconds;
  const countEl = document.getElementById('mp-spin-countdown');
  if (countEl) countEl.textContent = remaining;

  mpSpinCountdownTimer = setInterval(() => {
    remaining--;
    if (countEl) {
      countEl.textContent = remaining;
      countEl.style.color = remaining <= 5 ? '#dc2626' : remaining <= 10 ? '#d97706' : '#7c3aed';
    }
    if (remaining <= 0) {
      clearInterval(mpSpinCountdownTimer);
    }
  }, 1000);
}

function _stopMpCountdown() {
  clearInterval(mpSpinCountdownTimer);
  const countEl = document.getElementById('mp-spin-countdown');
  if (countEl) { countEl.textContent = '0'; countEl.style.color = '#9ca3af'; }
}

/**
 * 所有人均可点击：本地随机选一个结果，播放动画，完成后提交给服务端
 */
function handleMpWheelSpinVote() {
  if (mpSpinHasVoted) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (candidateSnapshot.length === 0) return;

  const btn = document.getElementById('btn-mp-wheel-spin');
  const label = document.getElementById('mp-spin-label');
  btn.disabled = true;
  mpSpinHasVoted = true;
  if (label) label.textContent = '旋转中…';

  // 本地随机决定结果
  const localIndex = Math.floor(Math.random() * candidateSnapshot.length);
  const localResult = candidateSnapshot[localIndex];

  // 播放旋转动画，结束后提交
  playLocalWheelAnimation(localIndex, () => {
    if (label) label.textContent = '✓ 已投票';
    ws.send(JSON.stringify({
      event: 'spin_submitted',
      data: {
        resultRestaurantId: localResult.id,
        resultRestaurantName: localResult.name,
        resultIndex: localIndex,
      },
    }));
  });
}

/**
 * 本地旋转动画（W3修复：直接绘制旋转后的转盘，不依赖 drawMpWheel 的 clearRect）
 */
function playLocalWheelAnimation(resultIndex, onComplete) {
  const canvas = document.getElementById('mp-wheel-canvas');
  if (!canvas || candidateSnapshot.length === 0) { onComplete?.(); return; }

  const total = candidateSnapshot.length;
  const sliceDeg = 360 / total;
  const targetDeg = resultIndex * sliceDeg + sliceDeg / 2;
  const spinDeg = 1080 + (360 - targetDeg);

  const startTime = performance.now();
  const duration = 2500;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 4;
  const colors = ['#fde8c0', '#dde6ff', '#d1fae5', '#fce7f3', '#fef3c7', '#e0f2fe'];
  const arc = (2 * Math.PI) / total;

  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function drawRotated(angleDeg) {
    const angleRad = (angleDeg * Math.PI) / 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    candidateSnapshot.forEach((item, i) => {
      const start = angleRad + i * arc - Math.PI / 2;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((start + end) / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#333';
      ctx.font = `bold ${Math.max(10, 14 - total / 3)}px sans-serif`;
      ctx.fillText(item.name?.slice(0, 6) || '', r - 8, 5);
      ctx.restore();
    });
  }

  function animate(now) {
    const t = Math.min((now - startTime) / duration, 1);
    drawRotated(ease(t) * spinDeg);
    if (t < 1) { requestAnimationFrame(animate); } else { onComplete?.(); }
  }
  requestAnimationFrame(animate);
}

// ── spin_progress：更新投票进度 ───────────────────────────────────
function onSpinProgress(data) {
  const { spunCount, totalCount } = data;
  const progressEl = document.getElementById('mp-spin-progress-text');
  if (progressEl) progressEl.textContent = `${spunCount}/${totalCount} 人已转`;
  mpSpinTotalParticipants = totalCount;
}

// ── round_result：投票结果揭晓 ────────────────────────────────────
function onRoundResult(data) {
  _stopMpCountdown();
  const { winner, allVotes } = data;
  currentResult = {
    resultRestaurantId: winner.restaurantId,
    resultRestaurantName: winner.restaurantName,
  };
  navigateToSessionResult(winner.restaurantName, winner.votes, allVotes);
}

// ── tie_break_start：平局，进入决胜轮 ────────────────────────────
function onTieBreakStart(data) {
  const { round, candidates, tiedRestaurants } = data;

  // 更新候选池为平局餐厅
  candidateSnapshot = candidates || candidateSnapshot;

  // 显示平局横幅
  const banner = document.getElementById('mp-tie-banner');
  const roundEl = document.getElementById('mp-tie-round');
  const descEl = document.getElementById('mp-tie-desc');
  if (banner) banner.classList.remove('hidden');
  if (roundEl) roundEl.textContent = round;
  if (descEl) {
    const names = (tiedRestaurants || []).map(r => r.restaurantName).join(' vs ');
    descEl.textContent = `${names} 票数相同，继续转盘！`;
  }

  // 重置转盘界面进入新一轮
  initMpWheel();
}

// ── no_result：所有人超时弃权 ────────────────────────────────────
function onNoResult(data) {
  _stopMpCountdown();
  const banner = document.getElementById('mp-no-result-banner');
  if (banner) banner.classList.remove('hidden');
  // 恢复按钮可点击（让用户重试）
  mpSpinHasVoted = false;
  const btn = document.getElementById('btn-mp-wheel-spin');
  const label = document.getElementById('mp-spin-label');
  if (btn) btn.disabled = false;
  if (label) label.textContent = '重新转！';
}

function resetMpWheel() {
  _stopMpCountdown();
  initMpWheel();
}

// ── 多人扫雷（Story 6.10）─────────────────────────────────────────
function initMpMine() {
  const grid = document.getElementById('mp-mine-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const count = Math.min(candidateSnapshot.length, 12);
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'mine-cell';
    cell.dataset.index = i;
    cell.innerHTML = '<div class="mine-cell__front">?</div><div class="mine-cell__back"></div>';
    cell.addEventListener('click', () => handleMpCellClick(i, cell));
    grid.appendChild(cell);
  }
}

function handleMpCellClick(index, cellEl) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  // 乐观更新
  cellEl.classList.add('flipping');
  ws.send(JSON.stringify({ event: 'cell_clicked', data: { cellIndex: index } }));
}

function revealMpMineCell(data) {
  const { cellIndex, resultRestaurantName, clickedBy } = data;
  const grid = document.getElementById('mp-mine-grid');
  if (!grid) {
    navigateToSessionResult(resultRestaurantName);
    return;
  }

  // 回滚所有乐观 flipping 状态
  grid.querySelectorAll('.mine-cell.flipping').forEach(c => c.classList.remove('flipping'));

  const cell = grid.querySelector(`[data-index="${cellIndex}"]`);
  if (cell) {
    const back = cell.querySelector('.mine-cell__back');
    if (back) back.textContent = resultRestaurantName || '';
    cell.classList.add('revealed');
  }

  setTimeout(() => navigateToSessionResult(resultRestaurantName), 1200);
}

function resetMpMine() {
  initMpMine();
}

// ── 跳转到结果页 ──────────────────────────────────────────────────
function navigateToSessionResult(restaurantName, votes, allVotes) {
  const cat = currentResult
    ? (candidateSnapshot.find(r => r.id === currentResult.resultRestaurantId)?.category || '')
    : '';

  document.getElementById('sr-restaurant-name').textContent = restaurantName || '';
  document.getElementById('sr-restaurant-category').textContent = cat ? `品类：${cat}` : '';

  // 多人转盘：显示票数 + 投票明细
  const votesEl = document.getElementById('sr-vote-summary');
  if (votesEl) {
    if (votes != null) {
      votesEl.classList.remove('hidden');
      const votesCountEl = document.getElementById('sr-vote-count');
      if (votesCountEl) votesCountEl.textContent = votes;

      const breakdownEl = document.getElementById('sr-vote-breakdown');
      if (breakdownEl && Array.isArray(allVotes)) {
        // C1: 使用 escapeHtml 防 XSS，nickname 和 restaurantName 均来自外部输入
        breakdownEl.innerHTML = allVotes.map(v =>
          `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:13px">
            <span style="color:#6b7280">${escapeHtml(v.nickname)}</span>
            <span style="font-weight:500;color:${v.isWinner ? '#059669' : '#111'}">${escapeHtml(v.restaurantName)}${v.isWinner ? ' ✓' : ''}</span>
          </div>`
        ).join('');
      }
    } else {
      votesEl.classList.add('hidden');
    }
  }

  // 更新重玩按钮
  const hintEl = document.getElementById('sr-replay-hint');
  if (hintEl) hintEl.textContent = `（剩余 ${remainingReplays} 次）`;

  if (isHost) {
    document.getElementById('sr-host-actions')?.classList.remove('hidden');
    document.getElementById('sr-guest-waiting')?.classList.add('hidden');
  } else {
    document.getElementById('sr-host-actions')?.classList.add('hidden');
    document.getElementById('sr-guest-waiting')?.classList.remove('hidden');
  }

  navigate('session-result');
}

// ── 发起人确认结果（Story 6.11）──────────────────────────────────
async function handleConfirm() {
  if (!currentResult) return;
  const btn = document.getElementById('btn-sr-confirm');
  btn.disabled = true;
  try {
    await api.post(`/api/sessions/${sessionToken}/confirm`, {
      resultRestaurantId:   currentResult.resultRestaurantId,
      resultRestaurantName: currentResult.resultRestaurantName,
    });
    // session_done WS 事件会触发跳转
  } catch (e) {
    showToast(e.message || '确认失败，请重试', 'error');
    btn.disabled = false;
  }
}

// ── 发起人换一个（Story 6.11）────────────────────────────────────
async function handleReplay() {
  const btn = document.getElementById('btn-sr-replay');
  btn.disabled = true;
  try {
    await api.post(`/api/sessions/${sessionToken}/replay`, {});
    // replay_initiated WS 事件会触发
  } catch (e) {
    showToast(e.message || '重玩失败', 'error');
    btn.disabled = false;
  }
}

// ── 辅助：多人转盘绘制（避免与 wheel.js 的 drawWheel 冲突）────────
function drawMpWheel(canvas, items) {
  if (typeof window.drawWheelOnCanvas === 'function') {
    window.drawWheelOnCanvas(canvas, items);
    return;
  }
  // 简版 fallback
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 4;
  const n = items.length;
  const colors = ['#fde8c0','#dde6ff','#d1fae5','#fce7f3','#fef3c7','#e0f2fe'];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  items.forEach((item, i) => {
    const start = (2 * Math.PI * i) / n - Math.PI / 2;
    const end   = (2 * Math.PI * (i + 1)) / n - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((start + end) / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.max(10, 14 - n / 3)}px sans-serif`;
    ctx.fillText(item.name?.slice(0, 6) || '', r - 8, 5);
    ctx.restore();
  });
}
