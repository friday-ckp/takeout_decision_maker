/**
 * 多人会话 Controller
 * Stories: 6.2-v2 / 6.4 / 6.7 / 6.8 / 6.9-new / 6.11
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');
const { broadcast, initVoteRound, recordVote, closeVoteRound, getVotesSummary } = require('../websocket/server');

// ── 创建会话 (Story 6.2-v2) ───────────────────────────────────────
async function createSession(req, res, next) {
  try {
    const userId = req.userId;
    const { selectedRestaurantIds, deadlineAt } = req.body;

    // ── 参数校验：餐厅数量 ────────────────────────────────────────
    if (!Array.isArray(selectedRestaurantIds) || selectedRestaurantIds.length < 2) {
      return fail(res, 40002, '至少选择2家餐厅');
    }
    if (selectedRestaurantIds.length > 20) {
      return fail(res, 40004, '最多选择20家餐厅');
    }

    // ── 参数校验：截止时间 ────────────────────────────────────────
    if (!deadlineAt) {
      return fail(res, 40003, '截止时间不能为空');
    }
    const deadlineDate = new Date(deadlineAt);
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      return fail(res, 40003, '截止时间必须晚于当前时间');
    }

    // ── 校验餐厅归属：必须全部属于该用户且未删除 ─────────────────
    const idList = selectedRestaurantIds.map(Number);
    const placeholders = idList.map(() => '?').join(',');
    const [validRows] = await pool.query(
      `SELECT id, name, category FROM restaurants
       WHERE id IN (${placeholders}) AND user_id = ? AND is_deleted = 0`,
      [...idList, userId]
    );

    if (validRows.length !== idList.length) {
      return fail(res, 40005, '包含无效的餐厅ID');
    }

    // ── 构建候选快照（原始列表，不展开权重） ─────────────────────
    const snapshot = validRows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category || '',
    }));

    const shareToken = uuidv4().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [ins] = await conn.query(
        `INSERT INTO decision_sessions
           (host_user_id, share_token, candidate_snapshot, status, expires_at, deadline_at)
         VALUES (?, ?, ?, 'waiting', ?, ?)`,
        [userId, shareToken, JSON.stringify(snapshot), expiresAt, deadlineDate]
      );
      const sessionId = ins.insertId;

      const [[host]] = await conn.query('SELECT name FROM users WHERE id = ?', [userId]);
      const nickname = host?.name || '发起人';

      await conn.query(
        `INSERT INTO session_participants (session_id, user_id, nickname, role)
         VALUES (?, ?, ?, 'host')`,
        [sessionId, userId, nickname]
      );

      await conn.commit();
      return success(res, {
        shareToken,
        sessionId,
        expiresAt: expiresAt.toISOString(),
        deadlineAt: deadlineDate.toISOString(),
      }, 'ok', 201);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    next(e);
  }
}

// ── 获取会话状态 ──────────────────────────────────────────────────
async function getSessionState(req, res, next) {
  try {
    const { token } = req.params;

    const [[session]] = await pool.query(
      'SELECT * FROM decision_sessions WHERE share_token = ?',
      [token]
    );

    if (!session) {
      return fail(res, 40401, '会话不存在', 404);
    }

    if (new Date() > new Date(session.expires_at) && session.status !== 'done') {
      await pool.query('UPDATE decision_sessions SET status = ? WHERE id = ?', ['expired', session.id]).catch(() => {});
      return fail(res, 41001, '会话已过期', 410);
    }

    if (session.status === 'expired') {
      return fail(res, 41001, '会话已过期', 410);
    }

    const [participants] = await pool.query(
      `SELECT user_id, nickname, role FROM session_participants WHERE session_id = ?`,
      [session.id]
    );

    let candidateSnapshot = [];
    try { candidateSnapshot = JSON.parse(session.candidate_snapshot || '[]'); } catch (_) {}

    return success(res, {
      sessionId: session.id,
      shareToken: session.share_token,
      status: session.status,
      expiresAt: session.expires_at,
      deadlineAt: session.deadline_at || null,
      participants,
      candidateSnapshot,
    });
  } catch (e) {
    next(e);
  }
}

// ── 加入会话 (Story 6.4 / 8.8) ──────────────────────────────────────────
// req.userId 由 optionalAuth 设置：已登录 → 实名加入；null → 匿名（需昵称）
async function joinSession(req, res, next) {
  try {
    const { token } = req.params;
    const { nickname } = req.body;
    const loggedInUserId = req.userId || null;

    // 匿名用户必须提供昵称
    if (!loggedInUserId) {
      if (!nickname || !nickname.trim()) {
        return fail(res, 40001, '昵称不能为空');
      }
      if (nickname.trim().length > 20) {
        return fail(res, 40001, '昵称最长20字');
      }
    }

    const [[session]] = await pool.query(
      'SELECT * FROM decision_sessions WHERE share_token = ?',
      [token]
    );

    if (!session) {
      return fail(res, 40401, '会话不存在', 404);
    }

    if (new Date() > new Date(session.expires_at)) {
      await pool.query('UPDATE decision_sessions SET status = ? WHERE id = ?', ['expired', session.id]).catch(() => {});
      return fail(res, 41001, '会话已过期', 410);
    }

    if (['expired', 'done'].includes(session.status)) {
      return fail(res, 41001, '会话已结束', 410);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let joinUserId;
      let joinNickname;

      if (loggedInUserId) {
        // ── 已登录用户：使用真实账户 ────────────────────────────────
        const [[user]] = await conn.query(
          'SELECT id, name FROM users WHERE id = ? AND is_temp = 0',
          [loggedInUserId]
        );
        if (!user) {
          await conn.rollback();
          return fail(res, 40401, '用户账户不存在', 404);
        }

        // 避免重复加入
        const [[existing]] = await conn.query(
          'SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?',
          [session.id, loggedInUserId]
        );
        if (existing) {
          await conn.rollback();
          conn.release();
          return success(res, { userId: loggedInUserId, sessionId: session.id, nickname: user.name }, 'ok', 200);
        }

        joinUserId   = loggedInUserId;
        joinNickname = user.name;
      } else {
        // ── 匿名用户：创建临时账户 ─────────────────────────────────
        const userExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const [userIns] = await conn.query(
          `INSERT INTO users (name, is_temp, expires_at) VALUES (?, 1, ?)`,
          [nickname.trim(), userExpiresAt]
        );
        joinUserId   = userIns.insertId;
        joinNickname = nickname.trim();
      }

      await conn.query(
        `INSERT INTO session_participants (session_id, user_id, nickname, role)
         VALUES (?, ?, ?, 'guest')`,
        [session.id, joinUserId, joinNickname]
      );

      await conn.commit();

      // WS 广播 participant_joined (Story 6.7)
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM session_participants WHERE session_id = ?`,
        [session.id]
      );
      broadcast(token, {
        event: 'participant_joined',
        data: { nickname: joinNickname, totalCount: countRow.cnt },
      });

      return success(res, { userId: joinUserId, sessionId: session.id, nickname: joinNickname }, 'ok', 201);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    next(e);
  }
}

// ── 开始决策 (Story 6.8) ──────────────────────────────────────────
async function startSession(req, res, next) {
  try {
    const { token } = req.params;

    const [[session]] = await pool.query(
      'SELECT * FROM decision_sessions WHERE share_token = ?',
      [token]
    );

    if (!session) return fail(res, 40401, '会话不存在', 404);
    if (session.status !== 'waiting') return fail(res, 40003, '会话状态不允许开始');

    await pool.query('UPDATE decision_sessions SET status = ? WHERE id = ?', ['deciding', session.id]);

    let candidateSnapshot = [];
    try { candidateSnapshot = JSON.parse(session.candidate_snapshot || '[]'); } catch (_) {}

    // 查询参与人数，初始化投票轮次（Story 6.9-new）
    const [[{ totalVoters }]] = await pool.query(
      'SELECT COUNT(*) AS totalVoters FROM session_participants WHERE session_id = ?',
      [session.id]
    );
    initVoteRound(token, session.id, totalVoters, candidateSnapshot, session.deadline_at);

    broadcast(token, {
      event: 'deciding_started',
      data: { status: 'deciding', deadlineAt: session.deadline_at || null, candidateSnapshot },
    });

    return success(res, { status: 'deciding' });
  } catch (e) {
    next(e);
  }
}

// ── 确认结果 (Story 6.11) ─────────────────────────────────────────
async function confirmSession(req, res, next) {
  try {
    const { token } = req.params;
    const { resultRestaurantId, resultRestaurantName } = req.body;

    if (!resultRestaurantName) return fail(res, 40001, 'resultRestaurantName 不能为空');

    const [[session]] = await pool.query(
      'SELECT * FROM decision_sessions WHERE share_token = ?',
      [token]
    );
    if (!session) return fail(res, 40401, '会话不存在', 404);
    if (session.host_user_id !== req.userId) {
      return fail(res, 40301, '只有发起人才能确认结果', 403);
    }
    if (!['deciding', 'deciding_locked'].includes(session.status)) {
      return fail(res, 40003, '会话状态不允许确认');
    }

    const [participants] = await pool.query(
      'SELECT user_id FROM session_participants WHERE session_id = ?',
      [session.id]
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (participants.length > 0) {
        const now = new Date();
        for (const p of participants) {
          await conn.query(
            `INSERT INTO decision_history (user_id, restaurant_id, restaurant_name, mode, decided_at)
             VALUES (?, ?, ?, 'vote', ?)`,
            [p.user_id, resultRestaurantId || null, resultRestaurantName, now]
          );
        }
      }

      await conn.query('UPDATE decision_sessions SET status = ? WHERE id = ?', ['done', session.id]);
      await conn.commit();

      broadcast(token, {
        event: 'session_done',
        data: { resultRestaurantId, resultRestaurantName },
      });

      return success(res, { status: 'done' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    next(e);
  }
}

// ── 换一个（多人重玩）(Story 6.11) ───────────────────────────────
async function replaySession(req, res, next) {
  try {
    const { token } = req.params;

    const [[session]] = await pool.query(
      'SELECT * FROM decision_sessions WHERE share_token = ?',
      [token]
    );
    if (!session) return fail(res, 40401, '会话不存在', 404);
    // W4: 只有 deciding / deciding_locked 状态才允许重玩
    if (!['deciding', 'deciding_locked'].includes(session.status)) {
      return fail(res, 40003, '会话未在决策中，不允许重玩');
    }

    const today = new Date().toISOString().slice(0, 10);
    const [[dc]] = await pool.query(
      `SELECT replay_count FROM daily_config WHERE user_id = ? AND date = ?`,
      [session.host_user_id, today]
    );
    const [[setting]] = await pool.query(
      `SELECT value FROM settings WHERE user_id = ? AND \`key\` = 'daily_replay_limit'`,
      [session.host_user_id]
    );

    const maxReplay = setting ? parseInt(setting.value, 10) : 3;
    const replayCount = dc ? dc.replay_count : 0;

    if (replayCount >= maxReplay) {
      return fail(res, 40004, '重玩次数已达上限');
    }

    await pool.query(
      `INSERT INTO daily_config (user_id, date, replay_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE replay_count = replay_count + 1`,
      [session.host_user_id, today]
    );

    await pool.query('UPDATE decision_sessions SET status = ? WHERE id = ?', ['deciding', session.id]);

    // 重置内存中的投票轮次（清除上一轮选票）
    const [participants] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM session_participants WHERE session_id = ?',
      [session.id]
    );
    const totalVoters = participants[0].cnt;
    const candidateSnapshot = JSON.parse(session.candidate_snapshot || '[]');
    initVoteRound(token, session.id, totalVoters, candidateSnapshot, session.deadline_at);

    const remainingReplays = maxReplay - (replayCount + 1);
    broadcast(token, { event: 'replay_initiated', data: { remainingReplays } });

    return success(res, { remainingReplays });
  } catch (e) {
    next(e);
  }
}

// ── 提交投票（Story 6.9-new）──────────────────────────────────────
async function submitVote(req, res, next) {
  try {
    const { token } = req.params;
    const { restaurantId, restaurantName } = req.body;

    if (!restaurantName) return fail(res, 40001, 'restaurantName 不能为空');

    const [[session]] = await pool.query(
      'SELECT id, status FROM decision_sessions WHERE share_token = ?',
      [token]
    );
    if (!session) return fail(res, 40401, '会话不存在', 404);
    if (session.status !== 'deciding') return fail(res, 40003, '投票尚未开始或已结束');

    // 用 userId 或 req body 里传来的 nickname 作为 userKey
    const userKey = req.userId
      ? `uid_${req.userId}`
      : req.body.nickname || req.headers['x-nickname'] || `anon_${Date.now()}`;

    const result = recordVote(token, userKey, restaurantId, restaurantName);
    if (result === 'no_round') return fail(res, 40003, '投票轮次不存在，请稍后重试');

    return success(res, { voted: true });
  } catch (e) {
    next(e);
  }
}

// ── 关闭投票（Story 6.9-new）──────────────────────────────────────
async function closeVote(req, res, next) {
  try {
    const { token } = req.params;

    const [[session]] = await pool.query(
      'SELECT id, status, host_user_id FROM decision_sessions WHERE share_token = ?',
      [token]
    );
    if (!session) return fail(res, 40401, '会话不存在', 404);
    if (session.status !== 'deciding') return fail(res, 40003, '会话不在决策中');
    if (session.host_user_id !== req.userId) return fail(res, 40301, '只有发起人可以关闭投票', 403);

    const closed = closeVoteRound(token);
    if (!closed) return fail(res, 40003, '投票轮次不存在或已结算');

    return success(res, { closed: true });
  } catch (e) {
    next(e);
  }
}

// ── 查询当前票数（Story 6.9-new）──────────────────────────────────
async function getVotes(req, res, next) {
  try {
    const { token } = req.params;

    const [[session]] = await pool.query(
      'SELECT id, status FROM decision_sessions WHERE share_token = ?',
      [token]
    );
    if (!session) return fail(res, 40401, '会话不存在', 404);

    const summary = getVotesSummary(token);
    if (!summary) return success(res, { votes: [], totalVoters: 0, votedCount: 0 });

    return success(res, summary);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createSession,
  getSessionState,
  joinSession,
  startSession,
  confirmSession,
  replaySession,
  submitVote,
  closeVote,
  getVotes,
};
