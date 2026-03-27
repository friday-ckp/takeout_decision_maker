const { pool } = require('../models/db');
const { success, fail } = require('../utils/response');

// ── GET /api/restaurants ──────────────────────────────────────────────────────
async function listRestaurants(req, res, next) {
  try {
    const userId = req.userId;
    const { keyword, tags } = req.query;

    let sql = `
      SELECT
        r.id, r.name, r.category, r.tags, r.notes,
        r.created_at AS createdAt, r.updated_at AS updatedAt,
        CASE WHEN urr.relation_type = 'favorite' THEN 1 ELSE 0 END AS isFavorite
      FROM restaurants r
      LEFT JOIN user_restaurant_relations urr
        ON urr.restaurant_id = r.id AND urr.user_id = ? AND urr.relation_type = 'favorite'
      WHERE r.user_id = ? AND r.is_deleted = 0
    `;
    const params = [userId, userId];

    // keyword 过滤
    if (keyword && keyword.trim()) {
      sql += ' AND r.name LIKE ?';
      params.push(`%${keyword.trim()}%`);
    }

    sql += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.query(sql, params);

    // tags 过滤（客户端二次过滤，因为 tags 存 JSON 字符串）
    let list = rows.map(r => ({
      ...r,
      tags: safeParseJSON(r.tags, []),
      isFavorite: !!r.isFavorite,
    }));

    if (tags && tags.trim()) {
      const filterTags = tags.split(',').map(t => t.trim()).filter(Boolean);
      list = list.filter(r =>
        filterTags.every(ft => r.tags.includes(ft))
      );
    }

    return success(res, { total: list.length, list });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/restaurants ─────────────────────────────────────────────────────
async function createRestaurant(req, res, next) {
  try {
    const userId = req.userId;
    const { name, category = null, tags = [], notes = '' } = req.body;

    // 校验
    if (!name || !name.trim()) {
      return fail(res, 40001, '名称不能为空');
    }
    if (name.length > 100) {
      return fail(res, 40001, '名称最长100字符');
    }
    if (category && category.length > 50) {
      return fail(res, 40001, '品类最长50字符');
    }
    if (!Array.isArray(tags)) {
      return fail(res, 40001, 'tags 必须为数组');
    }
    if (tags.length > 10) {
      return fail(res, 40001, '标签最多10个');
    }
    for (const tag of tags) {
      if (typeof tag === 'string' && tag.length > 20) {
        return fail(res, 40001, '单个标签最长20字符');
      }
    }
    if (notes && notes.length > 500) {
      return fail(res, 40001, '备注最长500字符');
    }

    // 同名检查
    const [existing] = await pool.query(
      'SELECT id FROM restaurants WHERE user_id = ? AND name = ? AND is_deleted = 0',
      [userId, name.trim()]
    );
    if (existing.length > 0) {
      return fail(res, 40901, '同名餐厅已存在', 409);
    }

    // 插入
    const [result] = await pool.query(
      'INSERT INTO restaurants (user_id, name, category, tags, notes) VALUES (?, ?, ?, ?, ?)',
      [userId, name.trim(), category || null, JSON.stringify(tags), notes || '']
    );

    const [newRow] = await pool.query(
      `SELECT id, name, category, tags, notes, created_at AS createdAt, updated_at AS updatedAt
       FROM restaurants WHERE id = ?`,
      [result.insertId]
    );

    const restaurant = {
      ...newRow[0],
      tags: safeParseJSON(newRow[0].tags, []),
      isFavorite: false,
    };

    return success(res, restaurant, 'ok', 201);
  } catch (err) {
    next(err);
  }
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

module.exports = { listRestaurants, createRestaurant };
