/**
 * Story 2.1: GET /api/candidates
 * 返回加权候选餐厅列表（排除拉黑，收藏 weight=2，普通 weight=1）
 */
const { pool } = require('../models/db');
const { success } = require('../utils/response');

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

/** Fisher-Yates 随机打乱 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getCandidates(req, res, next) {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit, 10) || 0;  // 0 = 不截断

    // 查询未删除、未拉黑餐厅，带收藏标记
    const [rows] = await pool.query(
      `SELECT
         r.id, r.name, r.category, r.tags, r.notes,
         CASE WHEN urr_fav.relation_type = 'favorite' THEN 1 ELSE 0 END AS isFavorite
       FROM restaurants r
       LEFT JOIN user_restaurant_relations urr_fav
         ON urr_fav.restaurant_id = r.id
         AND urr_fav.user_id = ?
         AND urr_fav.relation_type = 'favorite'
       LEFT JOIN user_restaurant_relations urr_black
         ON urr_black.restaurant_id = r.id
         AND urr_black.user_id = ?
         AND urr_black.relation_type = 'blacklist'
       WHERE r.user_id = ? AND r.is_deleted = 0 AND urr_black.id IS NULL
       ORDER BY r.created_at DESC`,
      [userId, userId, userId]
    );

    let candidates = rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category || '',
      tags: safeParseJSON(r.tags, []),
      notes: r.notes || '',
      isFavorite: !!r.isFavorite,
      weight: r.isFavorite ? 2 : 1,
    }));

    if (candidates.length === 0) {
      return success(res, { candidates: [], total: 0, sampledDown: false });
    }

    let sampledDown = false;

    // limit 截断逻辑
    if (limit > 0 && candidates.length > limit) {
      sampledDown = true;
      const favorites = candidates.filter(c => c.isFavorite);
      const normals   = candidates.filter(c => !c.isFavorite);

      if (favorites.length >= limit) {
        // 收藏本身超限：从收藏中随机抽 limit 个
        candidates = shuffle(favorites).slice(0, limit);
      } else {
        // 保留所有收藏，从普通餐厅中随机补足
        const need = limit - favorites.length;
        candidates = [...favorites, ...shuffle(normals).slice(0, need)];
      }
    }

    return success(res, {
      candidates,
      total: candidates.length,
      sampledDown,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCandidates };
