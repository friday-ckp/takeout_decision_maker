/**
 * Story 2.9 + 5.1: 决策历史记录 API
 */
const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');

const VALID_MODES = ['wheel', 'minesweeper'];

// POST /api/history — 记录一次决策
async function createHistory(req, res, next) {
  try {
    const userId = req.userId;
    const { restaurantId, mode } = req.body;

    if (!restaurantId) return fail(res, 40001, 'restaurantId 不能为空');
    if (!VALID_MODES.includes(mode)) return fail(res, 40001, 'mode 必须为 wheel 或 minesweeper');

    const [rows] = await pool.query(
      `SELECT id, name FROM restaurants WHERE id = ? AND user_id = ? AND is_deleted = 0`,
      [restaurantId, userId]
    );
    if (rows.length === 0) return fail(res, 40401, '餐厅不存在', 404);

    const [result] = await pool.query(
      `INSERT INTO decision_history (user_id, restaurant_id, restaurant_name, mode, decided_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, restaurantId, rows[0].name, mode]
    );

    const [newRow] = await pool.query(
      `SELECT dh.id, dh.user_id AS userId, dh.restaurant_id AS restaurantId,
              dh.restaurant_name AS restaurantName, dh.mode, dh.decided_at AS decidedAt
       FROM decision_history dh WHERE dh.id = ?`,
      [result.insertId]
    );
    return success(res, newRow[0], 'ok', 201);
  } catch (err) { next(err); }
}

// GET /api/history — 历史列表
async function listHistory(req, res, next) {
  try {
    const userId = req.userId;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM decision_history WHERE user_id = ?',
      [userId]
    );

    const [rows] = await pool.query(
      `SELECT id, restaurant_id AS restaurantId, restaurant_name AS restaurantName,
              mode, decided_at AS decidedAt
       FROM decision_history WHERE user_id = ?
       ORDER BY decided_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return success(res, { total, page, limit, list: rows });
  } catch (err) { next(err); }
}

module.exports = { createHistory, listHistory };
