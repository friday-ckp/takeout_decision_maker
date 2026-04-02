/**
 * Story 2.1 + 5.2 + 5.3 + 5.5 + 3.1
 * GET /api/candidates        — 转盘候选列表（含历史排除、心情/口味过滤）
 * GET /api/candidates/mine   — 扫雷候选格子数据
 */
const { pool } = require('../models/db');
const { success } = require('../utils/response');

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 获取用户设置（带默认值） */
async function getUserSettings(userId) {
  const [rows] = await pool.query(
    'SELECT `key`, value FROM settings WHERE user_id = ?',
    [userId]
  );
  const s = { daily_replay_limit: 3, history_exclude_days: 3 };
  rows.forEach(r => { s[r.key] = parseInt(r.value, 10); });
  return s;
}

/**
 * 核心查询：未删除 + 未拉黑，带收藏标记
 * 返回基础 candidates 数组
 */
async function queryBaseCandidates(userId) {
  const [rows] = await pool.query(
    `SELECT
       r.id, r.name, r.category, r.tags, r.notes,
       CASE WHEN urr_fav.relation_type = 'favorite' THEN 1 ELSE 0 END AS isFavorite
     FROM restaurants r
     LEFT JOIN user_restaurant_relations urr_fav
       ON urr_fav.restaurant_id = r.id AND urr_fav.user_id = ? AND urr_fav.relation_type = 'favorite'
     LEFT JOIN user_restaurant_relations urr_black
       ON urr_black.restaurant_id = r.id AND urr_black.user_id = ? AND urr_black.relation_type = 'blocked'
     WHERE (r.user_id = ? OR r.is_public = 1) AND r.is_deleted = 0 AND urr_black.id IS NULL
     ORDER BY r.created_at DESC`,
    [userId, userId, userId]
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category || '',
    tags: safeParseJSON(r.tags, []),
    notes: r.notes || '',
    isFavorite: !!r.isFavorite,
    weight: r.isFavorite ? 2 : 1,
  }));
}

/**
 * Story 5.2: 历史排除过滤
 * 将最近 N 天内决策过的餐厅从候选中移除（收藏不排除）
 * 若过滤后候选 < 2，降级不过滤
 */
async function applyHistoryExclusion(userId, candidates, excludeDays) {
  if (excludeDays <= 0) return { candidates, historyExcluded: false };

  const since = new Date();
  since.setDate(since.getDate() - excludeDays);
  const sinceStr = since.toISOString().slice(0, 19).replace('T', ' ');

  const [rows] = await pool.query(
    `SELECT DISTINCT restaurant_id FROM decision_history
     WHERE user_id = ? AND decided_at >= ?`,
    [userId, sinceStr]
  );
  const recentIds = new Set(rows.map(r => r.restaurant_id));

  const filtered = candidates.filter(c => c.isFavorite || !recentIds.has(c.id));
  if (filtered.length < 2) {
    // 降级：不排除（保持全量）
    return { candidates, historyExcluded: false, degraded: true };
  }
  return { candidates: filtered, historyExcluded: true, degraded: false };
}

/**
 * Story 5.3: 心情过滤
 * 心情映射 → 偏好标签权重加成 or 分类过滤
 * 😊开心  → 不过滤
 * 😐一般  → 不过滤
 * 😴困倦  → 偏好轻食、粥、面（weight+1），不强制过滤
 * 😤烦躁  → 排除辣食标签（可选，降级不过滤）
 */
function applyMoodFilter(candidates, mood) {
  if (!mood || mood === '😊' || mood === '😐') return candidates;

  if (mood === '😴') {
    // 困倦：轻食系标签额外加权
    const lightTags = ['轻食', '粥', '面', '清淡', '素食'];
    return candidates.map(c => {
      const hasLight = c.tags.some(t => lightTags.includes(t));
      return hasLight ? { ...c, weight: c.weight + 1 } : c;
    });
  }

  if (mood === '😤') {
    // 烦躁：尝试排除辣食，降级保留全部
    const spicyTags = ['辣', '麻辣', '重辣'];
    const filtered = candidates.filter(c => !c.tags.some(t => spicyTags.includes(t)));
    return filtered.length >= 2 ? filtered : candidates;
  }

  return candidates;
}

/**
 * Story 5.5: 口味偏好过滤
 * flavorTags: string[] — 用户选择的口味标签
 * 先过滤包含任一 flavorTag 的餐厅；若少于2，降级不过滤
 */
function applyFlavorFilter(candidates, flavorTags) {
  if (!flavorTags || flavorTags.length === 0) return candidates;
  const filtered = candidates.filter(c =>
    flavorTags.some(ft => c.tags.includes(ft))
  );
  return filtered.length >= 2 ? filtered : candidates;
}

// ── GET /api/candidates ───────────────────────────────────────────────────
async function getCandidates(req, res, next) {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit, 10) || 0;
    const mood = req.query.mood || null;
    const flavorTags = req.query.flavors
      ? req.query.flavors.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    let candidates = await queryBaseCandidates(userId);

    if (candidates.length === 0) {
      return success(res, { candidates: [], total: 0, sampledDown: false });
    }

    const settings = await getUserSettings(userId);

    // 5.2 历史排除
    const { candidates: afterHistory } = await applyHistoryExclusion(
      userId, candidates, settings.history_exclude_days
    );
    candidates = afterHistory;

    // 5.3 心情过滤（权重调整）
    candidates = applyMoodFilter(candidates, mood);

    // 5.5 口味偏好过滤
    candidates = applyFlavorFilter(candidates, flavorTags);

    let sampledDown = false;

    // limit 截断逻辑（>16 勾选逻辑）
    if (limit > 0 && candidates.length > limit) {
      sampledDown = true;
      const favorites = candidates.filter(c => c.isFavorite);
      const normals   = candidates.filter(c => !c.isFavorite);

      if (favorites.length >= limit) {
        candidates = shuffle(favorites).slice(0, limit);
      } else {
        const need = limit - favorites.length;
        candidates = [...favorites, ...shuffle(normals).slice(0, need)];
      }
    }

    return success(res, { candidates, total: candidates.length, sampledDown });
  } catch (err) { next(err); }
}

// ── GET /api/candidates/mine  (Story 3.1: 扫雷格子数据) ──────────────────
async function getMinesweepCandidates(req, res, next) {
  try {
    const userId = req.userId;
    const mood = req.query.mood || null;
    const flavorTags = req.query.flavors
      ? req.query.flavors.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    let candidates = await queryBaseCandidates(userId);

    if (candidates.length === 0) {
      return success(res, { cells: [], total: 0 });
    }

    const settings = await getUserSettings(userId);

    // 同样应用历史排除 + 心情 + 口味过滤
    const { candidates: afterHistory } = await applyHistoryExclusion(
      userId, candidates, settings.history_exclude_days
    );
    candidates = afterHistory;
    candidates = applyMoodFilter(candidates, mood);
    candidates = applyFlavorFilter(candidates, flavorTags);

    // 扫雷权重扩展：按 weight 展开，然后打乱
    const expanded = [];
    for (const c of candidates) {
      for (let w = 0; w < c.weight; w++) {
        expanded.push({ ...c });
      }
    }
    shuffle(expanded);

    // 固定格子数 16（4×4），餐厅格最多 10 个，其余补炸弹
    // 这样无论有多少餐厅，格子里始终有炸弹，体验更好
    const GRID_SIZE = 16;
    const MAX_RESTAURANT_CELLS = 10;

    // 从 expanded 中取前 MAX_RESTAURANT_CELLS 个（已打乱去重）
    const seen = new Set();
    const cells = [];
    for (const item of expanded) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      cells.push({
        id: item.id,
        name: item.name,
        category: item.category,
        tags: item.tags,
        isFavorite: item.isFavorite,
        weight: item.weight,
        revealed: false,
      });
      if (cells.length >= MAX_RESTAURANT_CELLS) break;
    }

    // 补炸弹格填满 GRID_SIZE
    const mineCount = Math.max(0, GRID_SIZE - cells.length);
    const allCells = shuffle([
      ...cells,
      ...Array.from({ length: mineCount }, () => ({ id: null, name: null, isMine: true, revealed: false })),
    ]);

    return success(res, { cells: allCells, total: cells.length });
  } catch (err) { next(err); }
}

module.exports = { getCandidates, getMinesweepCandidates };
