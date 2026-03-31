/**
 * WebSocket 服务器 (Story 6.1)
 * 使用 ws@8.x，内存 Map 管理房间状态
 * 路径: ws://host/ws/sessions/:token?nickname=Alice&userId=1
 */
const { WebSocketServer } = require('ws');
const url = require('url');
const { pool } = require('../models/db');

// 房间 Map: shareToken → [{ ws, userId, nickname, role }]
const rooms = new Map();

// 转盘投票轮次 Map: shareToken → { results, totalExpected, candidates, round, timeout }
const spinRounds = new Map();

// 投票轮次 Map (Story 6.9-new): shareToken → { votes: Map<userKey, voteData>, totalVoters, candidateSnapshot, deadlineTimer, finalized }
const voteRounds = new Map();

/**
 * 向某个会话的所有连接广播消息
 */
function broadcast(token, payload) {
  const conns = rooms.get(token) || [];
  const msg = JSON.stringify(payload);
  conns.forEach(({ ws }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  });
}

/**
 * 向某个会话广播，排除指定 ws
 */
function broadcastExcept(token, excludeWs, payload) {
  const conns = rooms.get(token) || [];
  const msg = JSON.stringify(payload);
  conns.forEach(({ ws }) => {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  });
}

/**
 * 获取会话信息（含过期检查）
 */
async function getSession(token) {
  const [rows] = await pool.query(
    'SELECT * FROM decision_sessions WHERE share_token = ?',
    [token]
  );
  return rows[0] || null;
}

/**
 * 获取会话参与者列表
 */
async function getParticipants(sessionId) {
  const [rows] = await pool.query(
    `SELECT sp.user_id, sp.nickname, sp.role
     FROM session_participants sp
     WHERE sp.session_id = ?
     ORDER BY sp.joined_at ASC`,
    [sessionId]
  );
  return rows;
}

/**
 * 初始化并附加到 HTTP server
 */
function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws/sessions' });

  wss.on('connection', async (ws, req) => {
    const parsed = url.parse(req.url, true);
    // URL: /ws/sessions?token=xxx&nickname=Alice&userId=1
    const { token, nickname, userId } = parsed.query;

    if (!token) {
      ws.send(JSON.stringify({ event: 'error', data: { code: 40001, message: '缺少 token 参数' } }));
      ws.close(4001);
      return;
    }

    let session;
    try {
      session = await getSession(token);
    } catch (e) {
      console.error('[WS] DB 查询失败', e.message);
      ws.send(JSON.stringify({ event: 'error', data: { code: 50001, message: '服务器内部错误' } }));
      ws.close(5001);
      return;
    }

    if (!session) {
      ws.send(JSON.stringify({ event: 'error', data: { code: 40401, message: '会话不存在或已过期' } }));
      ws.close(4404);
      return;
    }

    if (session.status === 'expired') {
      ws.send(JSON.stringify({ event: 'error', data: { code: 41001, message: '会话已过期' } }));
      ws.close(4410);
      return;
    }

    // 检查有效期
    if (new Date() > new Date(session.expires_at)) {
      await pool.query(
        'UPDATE decision_sessions SET status = ? WHERE id = ?',
        ['expired', session.id]
      ).catch(() => {});
      ws.send(JSON.stringify({ event: 'error', data: { code: 41001, message: '会话已过期' } }));
      ws.close(4410);
      return;
    }

    // 注册到房间
    if (!rooms.has(token)) {
      rooms.set(token, []);
    }

    const connInfo = {
      ws,
      userId: userId ? parseInt(userId, 10) : null,
      nickname: nickname || '匿名',
    };
    rooms.get(token).push(connInfo);

    // 发送初始 session_state
    try {
      const participants = await getParticipants(session.id);
      let candidateSnapshot = [];
      try {
        candidateSnapshot = session.candidate_snapshot
          ? JSON.parse(session.candidate_snapshot)
          : [];
      } catch (_) {}

      // 当前票数快照（如果投票已开始）
      const voteRound = voteRounds.get(token);
      const currentVotes = voteRound ? _buildVotesSummary(voteRound, candidateSnapshot) : [];

      ws.send(JSON.stringify({
        event: 'session_state',
        data: {
          status: session.status,
          deadlineAt: session.deadline_at || null,
          participants,
          candidateSnapshot,
          votes: currentVotes,
          votedCount: voteRound ? voteRound.votes.size : 0,
          totalVoters: voteRound ? voteRound.totalVoters : participants.length,
        },
      }));
    } catch (e) {
      console.error('[WS] 发送 session_state 失败', e.message);
    }

    // 处理客户端消息
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_) {
        console.warn('[WS] 非法 JSON 消息，已忽略');
        return;
      }

      const { event, data } = msg;

      try {
        // 转盘：任意参与者提交本人旋转结果 (Story 6.9-V2)
        if (event === 'spin_submitted') {
          await handleSpinSubmitted(token, session.id, connInfo, data);
        }

        // 扫雷：参与者点击格子
        if (event === 'cell_clicked') {
          await handleCellClicked(token, session.id, ws, connInfo, data);
        }
      } catch (e) {
        console.error('[WS] 处理消息出错', event, e.message);
      }
    });

    ws.on('close', () => {
      const conns = rooms.get(token);
      if (conns) {
        const idx = conns.indexOf(connInfo);
        if (idx !== -1) conns.splice(idx, 1);
        if (conns.length === 0) {
          rooms.delete(token);
          // C3: 房间清空时同步清理 spinRound，防止内存泄漏
          const round = spinRounds.get(token);
          if (round?.timeout) clearTimeout(round.timeout);
          spinRounds.delete(token);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] 连接错误', err.message);
    });
  });

  console.log('[WS] WebSocket 服务器已附加');
  return wss;
}

/**
 * 启动转盘投票轮次 (Story 6.9-V2)
 * 由 sessionsController.startSession / replaySession 在 wheel 模式下调用
 */
async function startSpinRound(token, sessionId) {
  let totalExpected = 1;
  let candidates = [];
  try {
    const [pRows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM session_participants WHERE session_id = ?',
      [sessionId]
    );
    totalExpected = pRows[0]?.cnt || 1;

    const [sRows] = await pool.query(
      'SELECT candidate_snapshot FROM decision_sessions WHERE id = ?',
      [sessionId]
    );
    candidates = JSON.parse(sRows[0]?.candidate_snapshot || '[]');
  } catch (e) {
    console.error('[WS] startSpinRound query error', e.message);
  }

  _initSpinRound(token, sessionId, totalExpected, candidates, 1);
}

/**
 * 初始化一轮投票（含重新开始决胜轮）
 */
function _initSpinRound(token, sessionId, totalExpected, candidates, roundNum) {
  const existing = spinRounds.get(token);
  if (existing?.timeout) clearTimeout(existing.timeout);

  const round = {
    results: [],
    totalExpected,
    candidates,
    round: roundNum,
    timeout: null,
    finalized: false,  // C2: 防止并发双调用
  };
  round.timeout = setTimeout(() => _finalizeRound(token, sessionId, round), 30000);
  spinRounds.set(token, round);
  console.log(`[WS] Spin round ${roundNum} for ${token}, expecting ${totalExpected} votes`);
}

/**
 * 处理参与者提交旋转结果 (Story 6.9-V2)
 * event: spin_submitted { resultRestaurantId, resultRestaurantName }
 */
async function handleSpinSubmitted(token, sessionId, connInfo, data) {
  const round = spinRounds.get(token);
  if (!round) return;

  const [rows] = await pool.query(
    'SELECT status FROM decision_sessions WHERE id = ?',
    [sessionId]
  );
  if (!rows[0] || rows[0].status !== 'deciding') return;

  // W2: 防止同一用户重复提交（userId 或 nickname 为去重 key）
  const dedupeKey = connInfo.userId || connInfo.nickname;
  const dedupeField = connInfo.userId ? 'userId' : 'nickname';
  if (dedupeKey && round.results.some(r => r[dedupeField] === dedupeKey)) return;

  const { resultRestaurantId, resultRestaurantName } = data || {};
  if (!resultRestaurantName) return;

  round.results.push({
    userId: connInfo.userId,
    nickname: connInfo.nickname,
    restaurantId: resultRestaurantId,
    restaurantName: resultRestaurantName,
  });

  broadcast(token, {
    event: 'spin_progress',
    data: { spunCount: round.results.length, totalCount: round.totalExpected },
  });

  if (round.results.length >= round.totalExpected) {
    clearTimeout(round.timeout);
    _finalizeRound(token, sessionId, round);
  }
}

/**
 * 统计票数，返回按票数降序排列的数组
 */
function _tallyVotes(results) {
  const map = new Map();
  results.forEach(r => {
    // W5: restaurantId=0 是 falsy，用 != null 判断
    const key = (r.restaurantId != null) ? String(r.restaurantId) : r.restaurantName;
    if (!map.has(key)) {
      map.set(key, { restaurantId: r.restaurantId, restaurantName: r.restaurantName, votes: 0 });
    }
    map.get(key).votes++;
  });
  return [...map.values()].sort((a, b) => b.votes - a.votes);
}

/**
 * 结算本轮投票：平局则进入决胜轮，否则广播最终结果
 */
function _finalizeRound(token, sessionId, round) {
  // C2: 防并发双调用
  if (round.finalized) return;
  round.finalized = true;
  spinRounds.delete(token);

  if (round.results.length === 0) {
    broadcast(token, { event: 'no_result', data: { message: '没有人转盘，请重试' } });
    // C5: 重新开始本轮，让用户可以重试
    _initSpinRound(token, sessionId, round.totalExpected, round.candidates, round.round);
    return;
  }

  const tally = _tallyVotes(round.results);
  const maxVotes = tally[0].votes;
  const tied = tally.filter(t => t.votes === maxVotes);

  // 平局且未超过3轮 → 进入决胜轮
  if (tied.length > 1 && round.round < 3) {
    const tieIds = new Set(tied.map(t => t.restaurantId).filter(Boolean));
    const tieNames = new Set(tied.map(t => t.restaurantName));
    const seen = new Set();
    const tieCandidates = round.candidates.filter(c => {
      const k = c.id || c.name;
      if (seen.has(k)) return false;
      if ((c.id && tieIds.has(c.id)) || tieNames.has(c.name)) {
        seen.add(k);
        return true;
      }
      return false;
    });

    broadcast(token, {
      event: 'tie_break_start',
      data: {
        round: round.round + 1,
        candidates: tieCandidates,
        tiedRestaurants: tied.map(t => ({
          restaurantId: t.restaurantId,
          restaurantName: t.restaurantName,
          votes: t.votes,
        })),
      },
    });

    _initSpinRound(token, sessionId, round.totalExpected, tieCandidates, round.round + 1);
    return;
  }

  // 有明确赢家（或第3轮仍平局随机选一个）
  const winner = tied[Math.floor(Math.random() * tied.length)];
  const allVotes = round.results.map(r => ({
    nickname: r.nickname,
    restaurantId: r.restaurantId,
    restaurantName: r.restaurantName,
    isWinner: (r.restaurantId === winner.restaurantId) || (r.restaurantName === winner.restaurantName),
  }));

  broadcast(token, {
    event: 'round_result',
    data: {
      winner: {
        restaurantId: winner.restaurantId,
        restaurantName: winner.restaurantName,
        votes: winner.votes,
      },
      allVotes,
    },
  });
}

/**
 * 处理扫雷点击事件 (Story 6.10)
 * 先到先得：使用 DB 更新 + status 锁
 */
async function handleCellClicked(token, sessionId, senderWs, connInfo, data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT status, candidate_snapshot FROM decision_sessions WHERE id = ? FOR UPDATE',
      [sessionId]
    );
    const session = rows[0];

    if (!session || session.status !== 'deciding') {
      await conn.rollback();
      return;
    }

    let candidates = [];
    try {
      candidates = JSON.parse(session.candidate_snapshot || '[]');
    } catch (_) {
      await conn.rollback();
      return;
    }

    const cellIndex = data?.cellIndex;
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex >= candidates.length) {
      await conn.rollback();
      return;
    }

    // 锁定状态
    await conn.query(
      'UPDATE decision_sessions SET status = ? WHERE id = ?',
      ['deciding_locked', sessionId]
    );
    await conn.commit();

    const result = candidates[cellIndex];
    broadcast(token, {
      event: 'result_revealed',
      data: {
        resultRestaurantId: result.id,
        resultRestaurantName: result.name,
        clickedBy: connInfo.nickname,
        cellIndex,
      },
    });
  } catch (e) {
    await conn.rollback().catch(() => {});
    console.error('[WS] 扫雷点击处理失败', e.message);
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────
// 投票机制（Story 6.9-new）
// ─────────────────────────────────────────────────────────────────

/**
 * 初始化投票轮次（由 startSession 在设置 deciding 后调用）
 */
function initVoteRound(token, sessionId, totalVoters, candidateSnapshot, deadlineAt) {
  const existing = voteRounds.get(token);
  if (existing?.deadlineTimer) clearTimeout(existing.deadlineTimer);

  let deadlineTimer = null;
  if (deadlineAt) {
    const msUntilDeadline = new Date(deadlineAt).getTime() - Date.now();
    if (msUntilDeadline > 0) {
      deadlineTimer = setTimeout(() => _finalizeVoteRound(token, sessionId), msUntilDeadline);
    } else {
      // 截止时间已过，延迟 100ms 后立即结算
      deadlineTimer = setTimeout(() => _finalizeVoteRound(token, sessionId), 100);
    }
  }

  voteRounds.set(token, {
    votes: new Map(),   // userKey → { restaurantId, restaurantName }
    totalVoters,
    candidateSnapshot,
    deadlineTimer,
    finalized: false,
  });

  console.log(`[Vote] initVoteRound token=${token} totalVoters=${totalVoters} deadline=${deadlineAt}`);
}

/**
 * 记录一票，广播 vote_updated，全票后自动结算
 * @returns {string} 'ok' | 'not_deciding' | 'no_round'
 */
function recordVote(token, userKey, restaurantId, restaurantName) {
  const round = voteRounds.get(token);
  if (!round || round.finalized) return 'no_round';

  // 覆盖旧票
  round.votes.set(userKey, { restaurantId, restaurantName });

  const summary = _buildVotesSummary(round, round.candidateSnapshot);
  broadcast(token, {
    event: 'vote_updated',
    data: {
      votes: summary,
      totalVoters: round.totalVoters,
      votedCount: round.votes.size,
    },
  });

  // 全部投完 → 自动结算
  if (round.votes.size >= round.totalVoters) {
    if (round.deadlineTimer) clearTimeout(round.deadlineTimer);
    _finalizeVoteRound(token, null);
  }

  return 'ok';
}

/**
 * 立即结算（close-vote 或截止时间到）
 */
function closeVoteRound(token) {
  const round = voteRounds.get(token);
  if (!round || round.finalized) return false;
  if (round.deadlineTimer) clearTimeout(round.deadlineTimer);
  _finalizeVoteRound(token, null);
  return true;
}

/**
 * 构建票数汇总数组（含 0 票候选项）
 */
function _buildVotesSummary(round, candidateSnapshot) {
  // 先以 candidateSnapshot 初始化所有候选项为 0 票
  const countMap = new Map();
  (candidateSnapshot || []).forEach(r => {
    countMap.set(String(r.id), { restaurantId: r.id, restaurantName: r.name, count: 0 });
  });
  // 累加实际票数
  round.votes.forEach(({ restaurantId, restaurantName }) => {
    const key = String(restaurantId);
    if (countMap.has(key)) {
      countMap.get(key).count++;
    } else {
      countMap.set(key, { restaurantId, restaurantName, count: 1 });
    }
  });
  return [...countMap.values()].sort((a, b) => b.count - a.count);
}

/**
 * 结算投票并广播 vote_result 或 no_votes
 */
function _finalizeVoteRound(token) {
  const round = voteRounds.get(token);
  if (!round) return;
  if (round.finalized) return;
  round.finalized = true;
  voteRounds.delete(token);

  if (round.votes.size === 0) {
    broadcast(token, { event: 'no_votes', data: { message: '无人投票，请重试' } });
    return;
  }

  const allVotes = _buildVotesSummary(round, round.candidateSnapshot);
  const maxCount = allVotes[0].count;
  const tied = allVotes.filter(v => v.count === maxCount);
  const isTie = tied.length > 1;
  const winner = tied[Math.floor(Math.random() * tied.length)];

  broadcast(token, {
    event: 'vote_result',
    data: { winner, allVotes, isTie },
  });
}

/**
 * 获取当前票数（供 HTTP GET /votes 使用）
 */
function getVotesSummary(token) {
  const round = voteRounds.get(token);
  if (!round) return null;
  return {
    votes: _buildVotesSummary(round, round.candidateSnapshot),
    totalVoters: round.totalVoters,
    votedCount: round.votes.size,
  };
}

module.exports = { attachWebSocketServer, broadcast, broadcastExcept, rooms, startSpinRound, initVoteRound, recordVote, closeVoteRound, getVotesSummary };
