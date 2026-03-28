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
        CASE WHEN urr_fav.relation_type = 'favorite' THEN 1 ELSE 0 END AS isFavorite,
        CASE WHEN urr_blk.relation_type = 'blocked'  THEN 1 ELSE 0 END AS isBlocked
      FROM restaurants r
      LEFT JOIN user_restaurant_relations urr_fav
        ON urr_fav.restaurant_id = r.id AND urr_fav.user_id = ? AND urr_fav.relation_type = 'favorite'
      LEFT JOIN user_restaurant_relations urr_blk
        ON urr_blk.restaurant_id = r.id AND urr_blk.user_id = ? AND urr_blk.relation_type = 'blocked'
      WHERE r.user_id = ? AND r.is_deleted = 0
    `;
    const params = [userId, userId, userId];

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
      isBlocked: !!r.isBlocked,
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

// ── PUT /api/restaurants/:id ───────────────────────────────────────────────
async function updateRestaurant(req, res, next) {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    const { name, category, tags, notes } = req.body;

    if (!name || !name.trim()) return fail(res, 40001, '名称不能为空');
    if (name.length > 100) return fail(res, 40001, '名称最长100字符');
    if (category && category.length > 50) return fail(res, 40001, '品类最长50字符');
    if (!Array.isArray(tags)) return fail(res, 40001, 'tags 必须为数组');
    if (tags.length > 10) return fail(res, 40001, '标签最多10个');
    if (notes && notes.length > 500) return fail(res, 40001, '备注最长500字符');

    const [existing] = await pool.query(
      'SELECT id FROM restaurants WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [id, userId]
    );
    if (existing.length === 0) return fail(res, 40401, '餐厅不存在', 404);

    // 同名检查（排除自身）
    const [dup] = await pool.query(
      'SELECT id FROM restaurants WHERE user_id = ? AND name = ? AND is_deleted = 0 AND id != ?',
      [userId, name.trim(), id]
    );
    if (dup.length > 0) return fail(res, 40901, '同名餐厅已存在', 409);

    await pool.query(
      'UPDATE restaurants SET name=?, category=?, tags=?, notes=? WHERE id=?',
      [name.trim(), category || null, JSON.stringify(tags || []), notes || '', id]
    );

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.category, r.tags, r.notes,
              r.created_at AS createdAt, r.updated_at AS updatedAt,
              CASE WHEN urr.relation_type = 'favorite' THEN 1 ELSE 0 END AS isFavorite
       FROM restaurants r
       LEFT JOIN user_restaurant_relations urr
         ON urr.restaurant_id = r.id AND urr.user_id = ? AND urr.relation_type = 'favorite'
       WHERE r.id = ?`,
      [userId, id]
    );
    const r = rows[0];
    return success(res, { ...r, tags: safeParseJSON(r.tags, []), isFavorite: !!r.isFavorite });
  } catch (err) { next(err); }
}

// ── DELETE /api/restaurants/:id  (软删除) ────────────────────────────────
async function deleteRestaurant(req, res, next) {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    const [existing] = await pool.query(
      'SELECT id FROM restaurants WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [id, userId]
    );
    if (existing.length === 0) return fail(res, 40401, '餐厅不存在', 404);

    await pool.query(
      'UPDATE restaurants SET is_deleted=1, deleted_at=NOW() WHERE id=?',
      [id]
    );
    return success(res, { id }, '已删除');
  } catch (err) { next(err); }
}

// ── GET /api/restaurants/trash  (回收站) ─────────────────────────────────
async function listTrash(req, res, next) {
  try {
    const userId = req.userId;
    const [rows] = await pool.query(
      `SELECT id, name, category, tags, notes, deleted_at AS deletedAt
       FROM restaurants WHERE user_id = ? AND is_deleted = 1
       ORDER BY deleted_at DESC`,
      [userId]
    );
    const list = rows.map(r => ({ ...r, tags: safeParseJSON(r.tags, []) }));
    return success(res, { total: list.length, list });
  } catch (err) { next(err); }
}

// ── POST /api/restaurants/:id/restore  (还原) ────────────────────────────
async function restoreRestaurant(req, res, next) {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    const [existing] = await pool.query(
      'SELECT id FROM restaurants WHERE id = ? AND user_id = ? AND is_deleted = 1',
      [id, userId]
    );
    if (existing.length === 0) return fail(res, 40401, '餐厅不在回收站', 404);

    await pool.query(
      'UPDATE restaurants SET is_deleted=0, deleted_at=NULL WHERE id=?',
      [id]
    );
    return success(res, { id }, '已还原');
  } catch (err) { next(err); }
}

// ── POST /api/restaurants/import  (JSON 批量导入) ─────────────────────────
async function importRestaurants(req, res, next) {
  try {
    const userId = req.userId;
    const { restaurants } = req.body;

    if (!Array.isArray(restaurants) || restaurants.length === 0) {
      return fail(res, 40001, 'restaurants 必须为非空数组');
    }
    if (restaurants.length > 200) {
      return fail(res, 40001, '单次最多导入200条');
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < restaurants.length; i++) {
      const item = restaurants[i];
      const name = item.name && item.name.trim();
      if (!name) { errors.push({ index: i, reason: '名称为空' }); skipped++; continue; }
      if (name.length > 100) { errors.push({ index: i, name, reason: '名称超长' }); skipped++; continue; }

      const category = item.category || null;
      const tags = Array.isArray(item.tags) ? item.tags.slice(0, 10) : [];
      const notes = item.notes || '';

      // 同名跳过
      const [dup] = await pool.query(
        'SELECT id FROM restaurants WHERE user_id = ? AND name = ? AND is_deleted = 0',
        [userId, name]
      );
      if (dup.length > 0) { skipped++; continue; }

      await pool.query(
        'INSERT INTO restaurants (user_id, name, category, tags, notes) VALUES (?, ?, ?, ?, ?)',
        [userId, name, category, JSON.stringify(tags), notes]
      );
      imported++;
    }

    return success(res, { imported, skipped, errors }, 'ok', 201);
  } catch (err) { next(err); }
}

// ── POST /api/restaurants/:id/favorite  (收藏/取消收藏) ──────────────────
async function toggleFavorite(req, res, next) {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);

    const [existing] = await pool.query(
      'SELECT id FROM restaurants WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [id, userId]
    );
    if (existing.length === 0) return fail(res, 40401, '餐厅不存在', 404);

    const [rel] = await pool.query(
      `SELECT id FROM user_restaurant_relations WHERE user_id = ? AND restaurant_id = ?`,
      [userId, id]
    );

    if (rel.length > 0) {
      const relRow = rel[0];
      const [curRel] = await pool.query(
        'SELECT relation_type FROM user_restaurant_relations WHERE id = ?',
        [relRow.id]
      );
      if (curRel[0].relation_type === 'favorite') {
        // 已收藏 → 取消
        await pool.query('DELETE FROM user_restaurant_relations WHERE id = ?', [relRow.id]);
        return success(res, { id, isFavorite: false });
      } else {
        // 是拉黑状态，不允许同时收藏
        return fail(res, 40901, '该餐厅已被拉黑，请先解除拉黑', 409);
      }
    } else {
      await pool.query(
        'INSERT INTO user_restaurant_relations (user_id, restaurant_id, relation_type) VALUES (?, ?, ?)',
        [userId, id, 'favorite']
      );
      return success(res, { id, isFavorite: true });
    }
  } catch (err) { next(err); }
}

// ── POST /api/restaurants/:id/block  (拉黑/解除拉黑) ─────────────────────
async function toggleBlock(req, res, next) {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);

    const [existing] = await pool.query(
      'SELECT id FROM restaurants WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [id, userId]
    );
    if (existing.length === 0) return fail(res, 40401, '餐厅不存在', 404);

    const [rel] = await pool.query(
      'SELECT id, relation_type FROM user_restaurant_relations WHERE user_id = ? AND restaurant_id = ?',
      [userId, id]
    );

    if (rel.length > 0 && rel[0].relation_type === 'blocked') {
      // 已拉黑 → 解除
      await pool.query('DELETE FROM user_restaurant_relations WHERE id = ?', [rel[0].id]);
      return success(res, { id, isBlocked: false });
    } else if (rel.length > 0 && rel[0].relation_type === 'favorite') {
      // 先移除收藏再拉黑
      await pool.query(
        'UPDATE user_restaurant_relations SET relation_type = ? WHERE id = ?',
        ['blocked', rel[0].id]
      );
      return success(res, { id, isBlocked: true });
    } else {
      await pool.query(
        'INSERT INTO user_restaurant_relations (user_id, restaurant_id, relation_type) VALUES (?, ?, ?)',
        [userId, id, 'blocked']
      );
      return success(res, { id, isBlocked: true });
    }
  } catch (err) { next(err); }
}

// ── GET /api/restaurants/blacklist ───────────────────────────────────────
async function listBlacklist(req, res, next) {
  try {
    const userId = req.userId;
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.category, r.tags, r.notes,
              urr.created_at AS blockedAt
       FROM restaurants r
       JOIN user_restaurant_relations urr
         ON urr.restaurant_id = r.id AND urr.user_id = ? AND urr.relation_type = 'blocked'
       WHERE r.is_deleted = 0
       ORDER BY urr.created_at DESC`,
      [userId]
    );
    const list = rows.map(r => ({ ...r, tags: safeParseJSON(r.tags, []) }));
    return success(res, { total: list.length, list });
  } catch (err) { next(err); }
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

module.exports = {
  listRestaurants, createRestaurant,
  updateRestaurant, deleteRestaurant,
  listTrash, restoreRestaurant,
  importRestaurants,
  toggleFavorite,
  toggleBlock, listBlacklist,
};
