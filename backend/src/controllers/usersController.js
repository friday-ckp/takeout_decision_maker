const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');

// ── GET /api/users/me ──────────────────────────────────────────────────────
async function getMe(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email FROM users WHERE id = ? AND is_temp = 0',
      [req.userId]
    );
    if (rows.length === 0) {
      return fail(res, 40401, '用户不存在', 404);
    }
    return success(res, rows[0]);
  } catch (err) {
    console.error('[Users] getMe error:', err.message);
    return fail(res, 50001, '服务器内部错误', 500);
  }
}

// ── PATCH /api/users/me ────────────────────────────────────────────────────
async function patchMe(req, res) {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return fail(res, 40001, '昵称不能为空', 400);
    }
    const trimmedName = String(name).trim();
    if (trimmedName.length > 50) {
      return fail(res, 40002, '昵称不能超过50个字符', 400);
    }

    // 用户必须存在
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE id = ? AND is_temp = 0',
      [req.userId]
    );
    if (existing.length === 0) {
      return fail(res, 40401, '用户不存在', 404);
    }

    await pool.query(
      'UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?',
      [trimmedName, req.userId]
    );

    const [updated] = await pool.query(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.userId]
    );

    return success(res, updated[0]);
  } catch (err) {
    console.error('[Users] patchMe error:', err.message);
    return fail(res, 50001, '服务器内部错误', 500);
  }
}

module.exports = { getMe, patchMe };
