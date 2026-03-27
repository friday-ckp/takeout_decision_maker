/**
 * Story 2.9: POST /api/history
 * 决策历史记录（基础版）
 */
const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');

const VALID_MODES = ['wheel', 'minesweeper'];

async function createHistory(req, res, next) {
  try {
    const userId = req.userId;
    const { restaurantId, mode } = req.body;

    if (!restaurantId) {
      return fail(res, 40001, 'restaurantId 不能为空');
    }
    if (!VALID_MODES.includes(mode)) {
      return fail(res, 40001, 'mode 必须为 wheel 或 minesweeper');
    }

    // 检查餐厅是否存在（且属于当前用户）
    const [rows] = await pool.query(
      `SELECT id, name FROM restaurants WHERE id = ? AND user_id = ? AND is_deleted = 0`,
      [restaurantId, userId]
    );
    if (rows.length === 0) {
      return fail(res, 40401, '餐厅不存在', 404);
    }

    const [result] = await pool.query(
      `INSERT INTO decision_history (user_id, restaurant_id, mode, decided_at)
       VALUES (?, ?, ?, NOW())`,
      [userId, restaurantId, mode]
    );

    const [newRow] = await pool.query(
      `SELECT
         dh.id, dh.user_id AS userId, dh.restaurant_id AS restaurantId,
         r.name AS restaurantName, dh.mode, dh.decided_at AS decidedAt
       FROM decision_history dh
       JOIN restaurants r ON r.id = dh.restaurant_id
       WHERE dh.id = ?`,
      [result.insertId]
    );

    return success(res, newRow[0], 'ok', 201);
  } catch (err) {
    next(err);
  }
}

module.exports = { createHistory };
