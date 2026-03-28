/**
 * 候选 API + 扫雷格子 集成测试
 * Stories: 2.1, 3.1, 5.2, 5.3, 5.5
 * GET /api/candidates       — 转盘候选列表
 * GET /api/candidates/mine  — 扫雷格子数据
 */

const request = require('supertest');
const app     = require('../../src/app');

jest.mock('../../src/models/db', () => ({
  pool: { query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(),
}));

const { pool } = require('../../src/models/db');
const USER_HEADER = { 'X-User-Id': '1' };

afterEach(() => jest.clearAllMocks());

// ── 基础 mock 数据 ─────────────────────────────────────────────────────────
const baseRestaurants = [
  { id: 1, name: '沙拉轻食', category: '轻食', tags: '["轻食","健康"]', notes: '', isFavorite: 0 },
  { id: 2, name: '麻辣香锅', category: '川菜', tags: '["辣","麻辣"]', notes: '', isFavorite: 0 },
  { id: 3, name: '粥铺',     category: '粤菜', tags: '["粥","清淡"]', notes: '', isFavorite: 1 },
  { id: 4, name: '烤肉',     category: '烤肉', tags: '["肉食"]',      notes: '', isFavorite: 0 },
  { id: 5, name: '披萨',     category: '西餐', tags: '["西餐","快餐"]',notes: '', isFavorite: 0 },
];

// 模拟：base candidates + settings + history
function mockBaseQueries(restaurants = baseRestaurants, historyIds = [], settings = null) {
  pool.query
    .mockResolvedValueOnce([restaurants])                              // queryBaseCandidates
    .mockResolvedValueOnce([settings || [                             // getUserSettings
      { key: 'daily_replay_limit', value: '3' },
      { key: 'history_exclude_days', value: '3' },
    ]])
    .mockResolvedValueOnce([historyIds.map(id => ({ restaurant_id: id }))]);  // applyHistoryExclusion
}

// ── GET /api/candidates ───────────────────────────────────────────────────
describe('GET /api/candidates', () => {
  test('返回全量候选列表', async () => {
    mockBaseQueries();
    const res = await request(app).get('/api/candidates').set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.candidates).toHaveLength(5);
    expect(res.body.data.sampledDown).toBe(false);
  });

  test('无候选餐厅返回空列表', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 无餐厅
    const res = await request(app).get('/api/candidates').set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.candidates).toHaveLength(0);
    expect(res.body.data.sampledDown).toBe(false);
  });

  test('候选数 > limit 时 sampledDown=true', async () => {
    mockBaseQueries(); // 5 条
    const res = await request(app).get('/api/candidates?limit=3').set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.sampledDown).toBe(true);
    expect(res.body.data.candidates).toHaveLength(3);
  });

  test('收藏餐厅的 weight 为 2', async () => {
    mockBaseQueries();
    const res = await request(app).get('/api/candidates').set(USER_HEADER);

    const zhoupu = res.body.data.candidates.find(c => c.id === 3); // 粥铺 isFavorite=1
    expect(zhoupu.weight).toBe(2);
  });

  test('历史排除：最近吃过的非收藏餐厅不在候选中', async () => {
    // id=2 (麻辣香锅) 最近吃过，应被排除；id=3 (粥铺) 是收藏，不排除
    mockBaseQueries(baseRestaurants, [2]);
    const res = await request(app).get('/api/candidates').set(USER_HEADER);

    const ids = res.body.data.candidates.map(c => c.id);
    expect(ids).not.toContain(2); // 被排除
    expect(ids).toContain(3);     // 收藏不排除
  });

  test('历史排除降级：排除后少于2个时恢复全量', async () => {
    // 排除 id=1,2,4,5 只剩 id=3（< 2），应降级返回全量
    mockBaseQueries(baseRestaurants, [1, 2, 4, 5]);
    const res = await request(app).get('/api/candidates').set(USER_HEADER);

    // 降级：返回全量（但 id=3 收藏，id=1,2,4,5 虽在历史中，因降级也保留）
    expect(res.body.data.candidates).toHaveLength(5);
  });

  test('心情 😴 困倦 - 轻食类 weight 加成', async () => {
    mockBaseQueries();
    const res = await request(app).get('/api/candidates?mood=😴').set(USER_HEADER);

    const salad = res.body.data.candidates.find(c => c.id === 1); // 轻食
    const spicy = res.body.data.candidates.find(c => c.id === 2); // 辣
    expect(salad.weight).toBe(2); // 1 + 1 加成
    expect(spicy.weight).toBe(1); // 无加成
  });

  test('心情 😤 烦躁 - 辣食被排除', async () => {
    mockBaseQueries();
    const res = await request(app).get('/api/candidates?mood=😤').set(USER_HEADER);

    const ids = res.body.data.candidates.map(c => c.id);
    expect(ids).not.toContain(2); // 麻辣香锅被排除
  });

  test('口味过滤：匹配到>=2个正常过滤', async () => {
    mockBaseQueries();
    const res = await request(app)
      .get('/api/candidates?flavors=轻食,粥')
      .set(USER_HEADER);

    const ids = res.body.data.candidates.map(c => c.id);
    expect(ids).toContain(1); // 沙拉轻食（轻食标签）
    expect(ids).toContain(3); // 粥铺（粥标签）
    expect(res.body.data.candidates).toHaveLength(2);
  });

  test('口味过滤：匹配少于2个时降级返回全量', async () => {
    mockBaseQueries();
    const res = await request(app)
      .get('/api/candidates?flavors=西餐')  // 只有披萨（id=5）匹配
      .set(USER_HEADER);

    // 降级，返回全量 5 条
    expect(res.body.data.candidates).toHaveLength(5);
  });

  test('缺少 X-User-Id 返回 400', async () => {
    const res = await request(app).get('/api/candidates');
    expect(res.status).toBe(400);
  });
});

// ── GET /api/candidates/mine ──────────────────────────────────────────────
describe('GET /api/candidates/mine (扫雷格子)', () => {
  test('返回扫雷格子数据，最少 8 格', async () => {
    // 只有 3 个候选
    const smallList = baseRestaurants.slice(0, 3);
    pool.query
      .mockResolvedValueOnce([smallList])
      .mockResolvedValueOnce([[
        { key: 'daily_replay_limit', value: '3' },
        { key: 'history_exclude_days', value: '3' },
      ]])
      .mockResolvedValueOnce([[]]); // 无历史

    const res = await request(app).get('/api/candidates/mine').set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.cells).toHaveLength(8); // 最少 8 格
    // 部分是真实餐厅，部分是 null 雷格
    const realCells = res.body.data.cells.filter(c => c.id !== null);
    expect(realCells.length).toBe(3);
    const mineCells = res.body.data.cells.filter(c => c.isMine === true);
    expect(mineCells.length).toBe(5); // 8 - 3 = 5 雷
  });

  test('候选充足时最多 24 格', async () => {
    // 构造 30 个候选，应截断为 24 格
    const bigList = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1, name: `餐厅${i+1}`, category: null, tags: '[]', notes: '', isFavorite: 0,
    }));
    pool.query
      .mockResolvedValueOnce([bigList])
      .mockResolvedValueOnce([[
        { key: 'daily_replay_limit', value: '3' },
        { key: 'history_exclude_days', value: '3' },
      ]])
      .mockResolvedValueOnce([[]]); // 无历史

    const res = await request(app).get('/api/candidates/mine').set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.cells).toHaveLength(24); // 最多 24 格
  });

  test('无候选时返回空格子', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 无餐厅
    const res = await request(app).get('/api/candidates/mine').set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.cells).toHaveLength(0);
  });

  test('收藏餐厅 weight=2，在展开池中出现 2 次（增大选中概率）', async () => {
    // 只有 1 个收藏 + 3 个普通，验证 total 正确
    const candidates = [
      { id: 1, name: '收藏餐厅', category: null, tags: '[]', notes: '', isFavorite: 1 },
      { id: 2, name: '普通A', category: null, tags: '[]', notes: '', isFavorite: 0 },
      { id: 3, name: '普通B', category: null, tags: '[]', notes: '', isFavorite: 0 },
      { id: 4, name: '普通C', category: null, tags: '[]', notes: '', isFavorite: 0 },
    ];
    pool.query
      .mockResolvedValueOnce([candidates])
      .mockResolvedValueOnce([[
        { key: 'daily_replay_limit', value: '3' },
        { key: 'history_exclude_days', value: '3' },
      ]])
      .mockResolvedValueOnce([[]]); // 无历史

    const res = await request(app).get('/api/candidates/mine').set(USER_HEADER);
    expect(res.status).toBe(200);
    // total 表示实际餐厅数量（去重后）
    expect(res.body.data.total).toBe(4);
  });

  test('每个格子包含 revealed 字段', async () => {
    pool.query
      .mockResolvedValueOnce([baseRestaurants])
      .mockResolvedValueOnce([[
        { key: 'daily_replay_limit', value: '3' },
        { key: 'history_exclude_days', value: '3' },
      ]])
      .mockResolvedValueOnce([[]]); // 无历史

    const res = await request(app).get('/api/candidates/mine').set(USER_HEADER);
    res.body.data.cells.forEach(cell => {
      expect(cell).toHaveProperty('revealed', false);
    });
  });
});
