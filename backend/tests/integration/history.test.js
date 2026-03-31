/**
 * 历史记录 API 集成测试
 * Stories: 2.9, 5.1
 * POST /api/history   — 记录决策
 * GET  /api/history   — 历史列表（分页）
 */

const request = require('supertest');
const app     = require('../../src/app');

jest.mock('../../src/models/db', () => ({
  pool: { query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(),
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn().mockReturnValue({ userId: 1 }) }));

const { pool } = require('../../src/models/db');

const USER_HEADER = { 'Authorization': 'Bearer test.token' };

afterEach(() => jest.clearAllMocks());

// ── POST /api/history ─────────────────────────────────────────────────────
describe('POST /api/history', () => {
  const validRecord = {
    id: 1, userId: 1, restaurantId: 10,
    restaurantName: '麦当劳', mode: 'wheel', decidedAt: new Date(),
  };

  test('wheel 模式记录成功', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10, name: '麦当劳' }]])  // 餐厅存在
      .mockResolvedValueOnce([{ insertId: 1 }])               // INSERT
      .mockResolvedValueOnce([[validRecord]]);                 // SELECT 新记录

    const res = await request(app)
      .post('/api/history')
      .set(USER_HEADER)
      .send({ restaurantId: 10, mode: 'wheel' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.mode).toBe('wheel');
    expect(res.body.data.restaurantName).toBe('麦当劳');
  });

  test('minesweeper 模式记录成功', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 11, name: '肯德基' }]])
      .mockResolvedValueOnce([{ insertId: 2 }])
      .mockResolvedValueOnce([[{ ...validRecord, id: 2, restaurantId: 11, restaurantName: '肯德基', mode: 'minesweeper' }]]);

    const res = await request(app)
      .post('/api/history')
      .set(USER_HEADER)
      .send({ restaurantId: 11, mode: 'minesweeper' });

    expect(res.status).toBe(201);
    expect(res.body.data.mode).toBe('minesweeper');
  });

  test('mode 非法返回 400', async () => {
    const res = await request(app)
      .post('/api/history')
      .set(USER_HEADER)
      .send({ restaurantId: 10, mode: 'roulette' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  test('缺少 restaurantId 返回 400', async () => {
    const res = await request(app)
      .post('/api/history')
      .set(USER_HEADER)
      .send({ mode: 'wheel' });
    expect(res.status).toBe(400);
  });

  test('餐厅不存在返回 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 餐厅不存在
    const res = await request(app)
      .post('/api/history')
      .set(USER_HEADER)
      .send({ restaurantId: 999, mode: 'wheel' });
    expect(res.status).toBe(404);
  });
});

// ── GET /api/history ──────────────────────────────────────────────────────
describe('GET /api/history', () => {
  test('返回分页历史列表', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 3 }]])   // COUNT 查询
      .mockResolvedValueOnce([[              // 列表查询
        { id: 3, restaurantId: 1, restaurantName: '海底捞', mode: 'wheel', decidedAt: new Date() },
        { id: 2, restaurantId: 2, restaurantName: '麦当劳', mode: 'minesweeper', decidedAt: new Date() },
      ]]);

    const res = await request(app).get('/api/history').set(USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.list).toHaveLength(2);
    expect(res.body.data.page).toBe(1);
  });

  test('分页参数正确处理', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 100 }]])
      .mockResolvedValueOnce([[]]); // 第3页无数据

    const res = await request(app)
      .get('/api/history?page=3&limit=10')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(3);
    expect(res.body.data.limit).toBe(10);

    // 验证 OFFSET = (3-1)*10 = 20
    const queryArgs = pool.query.mock.calls[1][1];
    expect(queryArgs).toContain(20); // offset = 20
  });

  test('limit 超过 50 时截断为 50', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 200 }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/history?limit=200')
      .set(USER_HEADER);

    expect(res.body.data.limit).toBe(50);
  });

  test('历史为空时正常返回', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/history').set(USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.list).toHaveLength(0);
  });
});
