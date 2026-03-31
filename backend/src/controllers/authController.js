const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /api/auth/register ────────────────────────────────────────────────
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // 入参校验
    if (!name || !String(name).trim()) {
      return fail(res, 40003, '昵称不能为空', 400);
    }
    if (!email || !EMAIL_RE.test(email)) {
      return fail(res, 40001, '邮箱格式不正确', 400);
    }
    if (!password || String(password).length < 8) {
      return fail(res, 40002, '密码长度不能少于8位', 400);
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = String(name).trim();

    // 检查邮箱是否已注册
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [trimmedEmail]
    );
    if (existing.length > 0) {
      return fail(res, 40901, '邮箱已被注册', 409);
    }

    // hash 密码
    const passwordHash = await bcrypt.hash(String(password), 10);

    // 写入用户
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, is_temp, updated_at)
       VALUES (?, ?, ?, 0, NOW())`,
      [trimmedName, trimmedEmail, passwordHash]
    );
    const userId = result.insertId;

    // 签发 JWT
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    return success(
      res,
      { userId, name: trimmedName, email: trimmedEmail, token },
      'ok',
      201
    );
  } catch (err) {
    console.error('[Auth] register error:', err.message);
    return fail(res, 50001, '服务器内部错误', 500);
  }
}

// ── POST /api/auth/login ───────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return fail(res, 40001, '邮箱或密码不能为空', 400);
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // 查找用户（is_temp=false 的正式账户）
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? AND is_temp = 0',
      [trimmedEmail]
    );

    // 用户不存在或密码错误统一返回 401（防枚举攻击）
    if (rows.length === 0) {
      return fail(res, 40101, '邮箱或密码错误', 401);
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(String(password), user.password_hash);
    if (!passwordMatch) {
      return fail(res, 40101, '邮箱或密码错误', 401);
    }

    // 签发 JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    return success(res, { token, userId: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('[Auth] login error:', err.message);
    return fail(res, 50001, '服务器内部错误', 500);
  }
}

module.exports = { register, login };
