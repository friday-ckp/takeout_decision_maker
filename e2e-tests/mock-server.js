/**
 * E2E 测试用内存 mock 服务器
 * 替代 MySQL，使用 JavaScript 对象存储数据
 * 实现与真实后端完全相同的 API 接口
 */
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ── 内存数据存储 ─────────────────────────────────────────────────────────────
let idCounter = 1;
const newId = () => idCounter++;

// 数据存储（按 userId 分隔）
const store = {
  restaurants: [],      // { id, userId, name, category, tags, notes, isDeleted, deletedAt, createdAt, updatedAt }
  relations: [],        // { id, userId, restaurantId, relationType, createdAt }
  history: [],          // { id, userId, restaurantId, restaurantName, mode, decidedAt }
  settings: {},         // { [userId]: { daily_replay_limit, history_exclude_days } }
  dailyConfig: {},      // { [userId+date]: { id, userId, date, replayCount, mood } }
};

function now() { return new Date().toISOString(); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── 工具 ────────────────────────────────────────────────────────────────────
function ok(res, data, message = 'ok', status = 200) {
  return res.status(status).json({ code: 0, message, data });
}
function fail(res, code, message, status = 400) {
  return res.status(status).json({ code, message, data: null });
}

// ── Auth 中间件 ──────────────────────────────────────────────────────────────
function requireUserId(req, res, next) {
  const uid = req.headers['x-user-id'];
  if (!uid) return res.status(400).json({ code: 40001, message: '缺少 X-User-Id', data: null });
  req.userId = parseInt(uid, 10);
  next();
}

// ── 静态文件服务 ─────────────────────────────────────────────────────────────
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'healthy' } });
});

// ── Restaurants ──────────────────────────────────────────────────────────────
app.get('/api/restaurants', requireUserId, (req, res) => {
  const { keyword, tags } = req.query;
  const userId = req.userId;
  let list = store.restaurants.filter(r => r.userId === userId && !r.isDeleted);

  if (keyword && keyword.trim()) {
    list = list.filter(r => r.name.includes(keyword.trim()));
  }
  if (tags && tags.trim()) {
    const ft = tags.split(',').map(t => t.trim()).filter(Boolean);
    list = list.filter(r => ft.every(t => r.tags.includes(t)));
  }

  list = list
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => ({
      ...r,
      isFavorite: store.relations.some(
        rel => rel.userId === userId && rel.restaurantId === r.id && rel.relationType === 'favorite'
      ),
    }));
  return ok(res, { total: list.length, list });
});

app.post('/api/restaurants', requireUserId, (req, res) => {
  const userId = req.userId;
  const { name, category = null, tags = [], notes = '' } = req.body;

  if (!name || !name.trim()) return fail(res, 40001, '名称不能为空');
  if (name.length > 100) return fail(res, 40001, '名称最长100字符');
  if (category && category.length > 50) return fail(res, 40001, '品类最长50字符');
  if (!Array.isArray(tags)) return fail(res, 40001, 'tags 必须为数组');
  if (tags.length > 10) return fail(res, 40001, '标签最多10个');
  if (notes && notes.length > 500) return fail(res, 40001, '备注最长500字符');

  if (store.restaurants.some(r => r.userId === userId && r.name === name.trim() && !r.isDeleted)) {
    return fail(res, 40901, '同名餐厅已存在', 409);
  }

  const restaurant = {
    id: newId(), userId, name: name.trim(), category: category || null,
    tags: Array.isArray(tags) ? tags : [],
    notes: notes || '', isDeleted: false, deletedAt: null,
    createdAt: now(), updatedAt: now(),
  };
  store.restaurants.push(restaurant);
  return ok(res, { ...restaurant, isFavorite: false }, 'ok', 201);
});

app.post('/api/restaurants/import', requireUserId, (req, res) => {
  const userId = req.userId;
  const { restaurants } = req.body;

  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return fail(res, 40001, 'restaurants 必须为非空数组');
  }
  if (restaurants.length > 200) return fail(res, 40001, '单次最多导入200条');

  let imported = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < restaurants.length; i++) {
    const item = restaurants[i];
    const name = item.name && item.name.trim();
    if (!name) { errors.push({ index: i, reason: '名称为空' }); skipped++; continue; }
    if (name.length > 100) { errors.push({ index: i, name, reason: '名称超长' }); skipped++; continue; }

    if (store.restaurants.some(r => r.userId === userId && r.name === name && !r.isDeleted)) {
      skipped++; continue;
    }

    store.restaurants.push({
      id: newId(), userId, name,
      category: item.category || null,
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 10) : [],
      notes: item.notes || '', isDeleted: false, deletedAt: null,
      createdAt: now(), updatedAt: now(),
    });
    imported++;
  }

  return ok(res, { imported, skipped, errors }, 'ok', 201);
});

app.get('/api/restaurants/trash', requireUserId, (req, res) => {
  const userId = req.userId;
  const list = store.restaurants
    .filter(r => r.userId === userId && r.isDeleted)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    .map(({ id, name, category, tags, notes, deletedAt }) => ({ id, name, category, tags, notes, deletedAt }));
  return ok(res, { total: list.length, list });
});

app.get('/api/restaurants/blacklist', requireUserId, (req, res) => {
  const userId = req.userId;
  const list = store.relations
    .filter(rel => rel.userId === userId && rel.relationType === 'blocked')
    .map(rel => {
      const r = store.restaurants.find(x => x.id === rel.restaurantId && !x.isDeleted);
      if (!r) return null;
      return { id: r.id, name: r.name, category: r.category, tags: r.tags, notes: r.notes, blockedAt: rel.createdAt };
    })
    .filter(Boolean)
    .sort((a, b) => b.blockedAt.localeCompare(a.blockedAt));
  return ok(res, { total: list.length, list });
});

app.post('/api/restaurants/:id/restore', requireUserId, (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  const r = store.restaurants.find(x => x.id === id && x.userId === userId && x.isDeleted);
  if (!r) return fail(res, 40401, '餐厅不在回收站', 404);
  r.isDeleted = false; r.deletedAt = null; r.updatedAt = now();
  return ok(res, { id });
});

app.post('/api/restaurants/:id/favorite', requireUserId, (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  const r = store.restaurants.find(x => x.id === id && x.userId === userId && !x.isDeleted);
  if (!r) return fail(res, 40401, '餐厅不存在', 404);

  const rel = store.relations.find(x => x.userId === userId && x.restaurantId === id);
  if (rel) {
    if (rel.relationType === 'favorite') {
      store.relations.splice(store.relations.indexOf(rel), 1);
      return ok(res, { id, isFavorite: false });
    } else {
      return fail(res, 40901, '该餐厅已被拉黑，请先解除拉黑', 409);
    }
  }
  store.relations.push({ id: newId(), userId, restaurantId: id, relationType: 'favorite', createdAt: now() });
  return ok(res, { id, isFavorite: true });
});

app.post('/api/restaurants/:id/block', requireUserId, (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  const r = store.restaurants.find(x => x.id === id && x.userId === userId && !x.isDeleted);
  if (!r) return fail(res, 40401, '餐厅不存在', 404);

  const rel = store.relations.find(x => x.userId === userId && x.restaurantId === id);
  if (rel && rel.relationType === 'blocked') {
    store.relations.splice(store.relations.indexOf(rel), 1);
    return ok(res, { id, isBlocked: false });
  } else if (rel && rel.relationType === 'favorite') {
    rel.relationType = 'blocked';
    return ok(res, { id, isBlocked: true });
  } else {
    store.relations.push({ id: newId(), userId, restaurantId: id, relationType: 'blocked', createdAt: now() });
    return ok(res, { id, isBlocked: true });
  }
});

app.put('/api/restaurants/:id', requireUserId, (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  const { name, category, tags, notes } = req.body;

  if (!name || !name.trim()) return fail(res, 40001, '名称不能为空');
  if (name.length > 100) return fail(res, 40001, '名称最长100字符');
  if (category && category.length > 50) return fail(res, 40001, '品类最长50字符');
  if (!Array.isArray(tags)) return fail(res, 40001, 'tags 必须为数组');
  if (tags.length > 10) return fail(res, 40001, '标签最多10个');
  if (notes && notes.length > 500) return fail(res, 40001, '备注最长500字符');

  const r = store.restaurants.find(x => x.id === id && x.userId === userId && !x.isDeleted);
  if (!r) return fail(res, 40401, '餐厅不存在', 404);

  if (store.restaurants.some(x => x.userId === userId && x.name === name.trim() && !x.isDeleted && x.id !== id)) {
    return fail(res, 40901, '同名餐厅已存在', 409);
  }

  r.name = name.trim(); r.category = category || null;
  r.tags = tags || []; r.notes = notes || ''; r.updatedAt = now();
  const isFavorite = store.relations.some(
    rel => rel.userId === userId && rel.restaurantId === id && rel.relationType === 'favorite'
  );
  return ok(res, { ...r, isFavorite });
});

app.delete('/api/restaurants/:id', requireUserId, (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  const r = store.restaurants.find(x => x.id === id && x.userId === userId && !x.isDeleted);
  if (!r) return fail(res, 40401, '餐厅不存在', 404);
  r.isDeleted = true; r.deletedAt = now(); r.updatedAt = now();
  return ok(res, { id });
});

// ── Candidates ───────────────────────────────────────────────────────────────
app.get('/api/candidates', requireUserId, (req, res) => {
  const userId = req.userId;
  const settings = store.settings[userId] || { daily_replay_limit: 3, history_exclude_days: 3 };
  const historyExcludeDays = settings.history_exclude_days || 3;
  const limitParam = parseInt(req.query.limit, 10) || 0;

  const blocked = new Set(
    store.relations
      .filter(r => r.userId === userId && r.relationType === 'blocked')
      .map(r => r.restaurantId)
  );

  let candidates = store.restaurants
    .filter(r => r.userId === userId && !r.isDeleted && !blocked.has(r.id))
    .map(r => ({
      ...r,
      isFavorite: store.relations.some(
        rel => rel.userId === userId && rel.restaurantId === r.id && rel.relationType === 'favorite'
      ),
    }));

  if (candidates.length === 0) {
    return ok(res, { candidates: [], total: 0, sampledDown: false });
  }

  // 历史排除（退化处理）
  const cutoff = new Date(Date.now() - historyExcludeDays * 86400000).toISOString();
  const recentHistoryIds = new Set(
    store.history.filter(h => h.userId === userId && h.decidedAt > cutoff).map(h => h.restaurantId)
  );
  const withoutHistory = candidates.filter(r => !recentHistoryIds.has(r.id));
  if (withoutHistory.length >= 2) candidates = withoutHistory;

  // 获取 mood（前端可通过 query 参数传入）
  const mood = req.query.mood || (() => {
    const todayKey = `${userId}:${todayStr()}`;
    return store.dailyConfig[todayKey]?.mood || null;
  })();

  // 应用 mood 过滤
  if (mood === '😤') {
    const spicyTags = ['辣', '麻辣', '川菜', '重口'];
    const filtered = candidates.filter(r => !r.tags.some(t => spicyTags.includes(t)));
    if (filtered.length >= 2) candidates = filtered;
  }

  // sampledDown 截断
  let sampledDown = false;
  if (limitParam > 0 && candidates.length > limitParam) {
    sampledDown = true;
    const favorites = candidates.filter(c => c.isFavorite);
    const normals   = candidates.filter(c => !c.isFavorite);
    if (favorites.length >= limitParam) {
      candidates = [...favorites].sort(() => Math.random() - 0.5).slice(0, limitParam);
    } else {
      const need = limitParam - favorites.length;
      candidates = [...favorites, ...[...normals].sort(() => Math.random() - 0.5).slice(0, need)];
    }
  }

  return ok(res, { candidates, total: candidates.length, sampledDown });
});

app.get('/api/candidates/mine', requireUserId, (req, res) => {
  const userId = req.userId;
  const settings = store.settings[userId] || { history_exclude_days: 3 };
  const historyExcludeDays = settings.history_exclude_days || 3;

  const cutoff = new Date(Date.now() - historyExcludeDays * 86400000).toISOString();
  const recentHistoryIds = new Set(
    store.history.filter(h => h.userId === userId && h.decidedAt > cutoff).map(h => h.restaurantId)
  );
  const blocked = new Set(
    store.relations.filter(r => r.userId === userId && r.relationType === 'blocked').map(r => r.restaurantId)
  );

  let candidates = store.restaurants.filter(r => r.userId === userId && !r.isDeleted && !blocked.has(r.id));
  const withoutHistory = candidates.filter(r => !recentHistoryIds.has(r.id));
  if (withoutHistory.length >= 2) candidates = withoutHistory;

  if (candidates.length === 0) {
    return ok(res, { cells: [], total: 0 });
  }

  // 固定 16 格，餐厅格最多 10 个，其余补炸弹
  const GRID_SIZE = 16;
  const MAX_RESTAURANT = 10;
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const restaurantCells = shuffled.slice(0, MAX_RESTAURANT).map(r => ({
    id: r.id, name: r.name, category: r.category || null,
    tags: r.tags || [], isFavorite: r.isFavorite || false, revealed: false,
  }));
  const mineCount = GRID_SIZE - restaurantCells.length;
  const allCells = [...restaurantCells,
    ...Array.from({ length: mineCount }, () => ({ id: null, name: null, isMine: true, revealed: false })),
  ].sort(() => Math.random() - 0.5);

  return ok(res, { cells: allCells, total: restaurantCells.length });
});

// ── History ───────────────────────────────────────────────────────────────────
app.post('/api/history', requireUserId, (req, res) => {
  const userId = req.userId;
  const { restaurantId, mode } = req.body;

  if (!restaurantId) return fail(res, 40001, 'restaurantId 不能为空');
  if (!['wheel', 'minesweeper'].includes(mode)) return fail(res, 40001, 'mode 必须为 wheel 或 minesweeper');

  const r = store.restaurants.find(x => x.id === restaurantId && x.userId === userId && !x.isDeleted);
  if (!r) return fail(res, 40401, '餐厅不存在', 404);

  const record = { id: newId(), userId, restaurantId, restaurantName: r.name, mode, decidedAt: now() };
  store.history.push(record);
  return ok(res, {
    id: record.id, userId: record.userId, restaurantId: record.restaurantId,
    restaurantName: record.restaurantName, mode: record.mode, decidedAt: record.decidedAt,
  }, 'ok', 201);
});

app.get('/api/history', requireUserId, (req, res) => {
  const userId = req.userId;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const all = store.history.filter(h => h.userId === userId).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
  const list = all.slice(offset, offset + limit).map(
    ({ id, restaurantId, restaurantName, mode, decidedAt }) =>
      ({ id, restaurantId, restaurantName, mode, decidedAt })
  );
  return ok(res, { total: all.length, page, limit, list });
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', requireUserId, (req, res) => {
  const userId = req.userId;
  const s = store.settings[userId] || {};
  return ok(res, {
    daily_replay_limit: s.daily_replay_limit ?? 3,
    history_exclude_days: s.history_exclude_days ?? 3,
  });
});

app.patch('/api/settings', requireUserId, (req, res) => {
  const userId = req.userId;
  const allowed = ['daily_replay_limit', 'history_exclude_days'];
  const validators = {
    daily_replay_limit:   v => Number.isInteger(+v) && +v >= 1 && +v <= 10,
    history_exclude_days: v => Number.isInteger(+v) && +v >= 0 && +v <= 30,
  };

  for (const key of Object.keys(req.body)) {
    if (!allowed.includes(key)) return fail(res, 40001, `不支持的设置项: ${key}`);
    if (!validators[key](req.body[key])) return fail(res, 40001, `${key} 值非法`);
  }

  if (!store.settings[userId]) store.settings[userId] = { daily_replay_limit: 3, history_exclude_days: 3 };
  Object.assign(store.settings[userId], req.body);
  return ok(res, { ...store.settings[userId] });
});

// ── Daily Config ──────────────────────────────────────────────────────────────
app.get('/api/daily-config', requireUserId, (req, res) => {
  const userId = req.userId;
  const today = todayStr();
  const key = `${userId}:${today}`;

  if (!store.dailyConfig[key]) {
    store.dailyConfig[key] = { id: newId(), userId, date: today, replayCount: 0, mood: null, createdAt: now(), updatedAt: now() };
  }

  const cfg = store.dailyConfig[key];
  const settings = store.settings[userId] || {};
  return ok(res, { ...cfg, maxReplayCount: settings.daily_replay_limit ?? 3 });
});

app.patch('/api/daily-config', requireUserId, (req, res) => {
  const userId = req.userId;
  const today = todayStr();
  const key = `${userId}:${today}`;

  if (!store.dailyConfig[key]) return fail(res, 40401, '当日配置不存在，请先 GET /api/daily-config', 404);
  const cfg = store.dailyConfig[key];
  const settings = store.settings[userId] || {};
  const maxReplay = settings.daily_replay_limit ?? 3;

  const { incrementReplay, mood } = req.body;
  if (incrementReplay) {
    if (cfg.replayCount >= maxReplay) return fail(res, 40001, '今日重玩次数已达上限');
    cfg.replayCount++;
  }
  if (mood !== undefined) {
    const validMoods = ['😊', '😐', '😴', '😤', null];
    if (!validMoods.includes(mood)) return fail(res, 40001, 'mood 必须为 😊/😐/😴/😤 之一或 null');
    cfg.mood = mood;
  }
  cfg.updatedAt = now();
  return ok(res, { ...cfg, maxReplayCount: maxReplay });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDir, 'pages/index.html'));
  } else {
    next();
  }
});

// ── 启动 ──────────────────────────────────────────────────────────────────────
const PORT = process.env.MOCK_PORT || 3000;
app.listen(PORT, () => {
  console.log(`[mock-server] listening on http://localhost:${PORT}`);
});

module.exports = app;
