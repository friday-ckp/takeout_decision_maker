/**
 * Story 2.2: GET /api/daily-config  +  PATCH /api/daily-config
 * 每日配置：重玩次数 & 心情
 */
const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');

const VALID_MOODS = ['😊', '😐', '😴', '😤', null];
const DEFAULT_MAX_REPLAY = 3;

/** 获取或创建当日配置 */
async function getDailyConfig(req, res, next) {
  try {
    const userId = req.userId;
    const today = getTodayStr();

    await pool.query(
      `INSERT INTO daily_config (user_id, date, replay_count, mood)
       VALUES (?, ?, 0, NULL)
       ON DUPLICATE KEY UPDATE
         replay_count = IF(date = VALUES(date), replay_count, 0),
         date = IF(date != VALUES(date), VALUES(date), date),
         mood = IF(date != VALUES(date), NULL, mood)`,
      [userId, today]
    );

    const [rows] = await pool.query(
      `SELECT id, user_id AS userId, date, replay_count AS replayCount, mood,
              created_at AS createdAt, updated_at AS updatedAt
       FROM daily_config WHERE user_id = ? AND date = ?`,
      [userId, today]
    );

    // 附带 maxReplayCount（来自 settings，暂时写死默认值）
    const config = { ...rows[0], maxReplayCount: DEFAULT_MAX_REPLAY };
    return success(res, config);
  } catch (err) {
    next(err);
  }
}

/** 更新当日配置：incrementReplay 或 mood */
async function patchDailyConfig(req, res, next) {
  try {
    const userId = req.userId;
    const today  = getTodayStr();
    const { incrementReplay, mood } = req.body;

    // 读取当前记录
    const [rows] = await pool.query(
      `SELECT id, replay_count, mood FROM daily_config WHERE user_id = ? AND date = ?`,
      [userId, today]
    );
    if (rows.length === 0) {
      return fail(res, 40401, '当日配置不存在，请先 GET /api/daily-config', 404);
    }

    const record = rows[0];

    if (incrementReplay) {
      if (record.replay_count >= DEFAULT_MAX_REPLAY) {
        return fail(res, 40001, '今日重玩次数已达上限');
      }
      await pool.query(
        `UPDATE daily_config SET replay_count = replay_count + 1 WHERE id = ?`,
        [record.id]
      );
    }

    if (mood !== undefined) {
      if (!VALID_MOODS.includes(mood)) {
        return fail(res, 40001, 'mood 必须为 😊/😐/😴/😤 之一或 null');
      }
      await pool.query(
        `UPDATE daily_config SET mood = ? WHERE id = ?`,
        [mood, record.id]
      );
    }

    const [updated] = await pool.query(
      `SELECT id, user_id AS userId, date, replay_count AS replayCount, mood,
              created_at AS createdAt, updated_at AS updatedAt
       FROM daily_config WHERE id = ?`,
      [record.id]
    );

    return success(res, { ...updated[0], maxReplayCount: DEFAULT_MAX_REPLAY });
  } catch (err) {
    next(err);
  }
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { getDailyConfig, patchDailyConfig };
