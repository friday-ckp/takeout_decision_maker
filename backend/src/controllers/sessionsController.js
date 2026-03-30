/**
 * 多人会话 Controller
 * Stories: 6.2 / 6.4 / 6.7 / 6.8 / 6.11
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');
const { broadcast, startSpinRound } = require('../websocket/server');

// ── 创建会话 (Story 6.2) ──────────────────────────────────────────
async function createSession(req, res, next) {
  try {
    const userId = req.userId;
    const { mode } = req.body;

    if (!mode || !['wheel', 'minesweeper'].includes(mode)) {
      return fail(res, 40001, 'mode 必须为 wheel 或 minesweeper');
    }

    // 获取候选餐厅（排除拉黑）
    const [candidates] = await pool.query(
      `SELECT r.id, r.name, r.category,
              CASE WHEN urr.relation_type = 'favorite' THEN 1 ELSE 0 END AS isFavorite
       FROM restaurants r
       LEFT JOIN user_restaurant_relations urr
         ON urr.restaurant_id = r.id AND urr.user_id = ? AND urr.relation_type = 'favorite'
       WHERE r.user_id = ? AND r.is_deleted = 0
         AND r.id NOT IN (
           SELECT restaurant_id FROM user_restaurant_relations
           WHERE user_id = ? AND relation_type = 'blocked'
         )`,
      [userId, userId, userId]
    );

    if (candidates.length < 2) {
      return fail(res, 40002, '候选餐厅不足2家，无法创建多人会话');
    }

    // 构建展开后权重数组（收藏2倍）
    const snapshot = [];
    candidates.forEach(r => {
      const item = { id: r.id, name: r.name, category: r.category || '' };
      snapshot.push(item);
      if (r.isFavorite) {
        snapshot.push(item); // 收藏出现2次
      }
    });

    const shareToken = uuidv4().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [ins] = await conn.query(
        `INSERT INTO decision_sessions (host_user_id, share_token, mode, candidate_snapshot, status, expires_at)
         VALUES (?, ?, ?, ?, 'waiting', ?)`,
        [userId, shareToken, mode, JSON.stringify(snapshot), expiresAt]
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
      return success(res, { shareToken, sessionId, expiresAt: expiresAt.toISOString() }, 'ok', 201);
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
      mode: session.mode,
      status: session.status,
      expiresAt: session.expires_at,
      participants,
      candidateSnapshot,
    });
  } catch (e) {
    next(e);
  }
}

// ── 加入会话 (Story 6.4) ──────────────────────────────────────────
async function joinSession(req, res, next) {
  try {
    const { token } = req.params;
    const { nickname } = req.body;

    if (!nickname || !nickname.trim()) {
      return fail(res, 40001, '昵称不能为空');
    }
    if (nickname.trim().length > 20) {
      return fail(res, 40001, '昵称最长20字');
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

      const userExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [userIns] = await conn.query(
        `INSERT INTO users (name, is_temp, expires_at) VALUES (?, 1, ?)`,
        [nickname.trim(), userExpiresAt]
      );
      const newUserId = userIns.insertId;

      await conn.query(
        `INSERT INTO session_participants (session_id, user_id, nickname, role)
         VALUES (?, ?, ?, 'guest')`,
        [session.id, newUserId, nickname.trim()]
      );

      await conn.commit();

      // WS 广播 participant_joined (Story 6.7)
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM session_participants WHERE session_id = ?`,
        [session.id]
      );
      broadcast(token, {
        event: 'participant_joined',
        data: { nickname: nickname.trim(), totalCount: countRow.cnt },
      });

      return success(res, { userId: newUserId, sessionId: session.id }, 'ok', 201);
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

    broadcast(token, {
      event: 'deciding_started',
      data: { status: 'deciding', mode: session.mode, candidateSnapshot },
    });

    // wheel 模式：启动投票轮次（30s 超时收集所有人结果）
    if (session.mode === 'wheel') {
      startSpinRound(token, session.id).catch(e =>
        console.error('[sessions] startSpinRound failed', e.message)
      );
    }

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
             VALUES (?, ?, ?, ?, ?)`,
            [p.user_id, resultRestaurantId || null, resultRestaurantName, session.mode, now]
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

    const remainingReplays = maxReplay - (replayCount + 1);
    broadcast(token, { event: 'replay_initiated', data: { remainingReplays } });

    // wheel 模式重玩：重新启动投票轮次
    if (session.mode === 'wheel') {
      startSpinRound(token, session.id).catch(e =>
        console.error('[sessions] startSpinRound(replay) failed', e.message)
      );
    }

    return success(res, { remainingReplays });
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
};
