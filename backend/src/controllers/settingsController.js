/**
 * Story 4.1: GET /api/settings  +  PATCH /api/settings
 * 全局个性化设置
 */
const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');

const ALLOWED_KEYS = ['daily_replay_limit', 'history_exclude_days'];
const KEY_VALIDATORS = {
  daily_replay_limit:   v => Number.isInteger(+v) && +v >= 1 && +v <= 10,
  history_exclude_days: v => Number.isInteger(+v) && +v >= 0 && +v <= 30,
};

async function getSettings(req, res, next) {
  try {
    const userId = req.userId;
    const [rows] = await pool.query(
      'SELECT `key`, value FROM settings WHERE user_id = ?',
      [userId]
    );
    const settings = { daily_replay_limit: 3, history_exclude_days: 3 };
    rows.forEach(r => { settings[r.key] = parseInt(r.value, 10); });
    return success(res, settings);
  } catch (err) { next(err); }
}

async function patchSettings(req, res, next) {
  try {
    const userId = req.userId;
    const updates = req.body;

    for (const key of Object.keys(updates)) {
      if (!ALLOWED_KEYS.includes(key)) {
        return fail(res, 40001, `不支持的设置项: ${key}`);
      }
      if (!KEY_VALIDATORS[key](updates[key])) {
        return fail(res, 40001, `${key} 值非法`);
      }
    }

    for (const [key, val] of Object.entries(updates)) {
      await pool.query(
        `INSERT INTO settings (user_id, \`key\`, value) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [userId, key, String(val)]
      );
    }

    const [rows] = await pool.query(
      'SELECT `key`, value FROM settings WHERE user_id = ?',
      [userId]
    );
    const settings = { daily_replay_limit: 3, history_exclude_days: 3 };
    rows.forEach(r => { settings[r.key] = parseInt(r.value, 10); });
    return success(res, settings);
  } catch (err) { next(err); }
}

module.exports = { getSettings, patchSettings };
