/**
 * 多人会话 API 集成测试
 * Story: 6.2-v2
 * POST /api/sessions — 创建会话（自选餐厅 + 截止时间）
 */

const request = require('supertest');
const app     = require('../../src/app');

jest.mock('../../src/models/db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/websocket/server', () => ({
  broadcast: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 1 }),
  sign:   jest.fn().mockReturnValue('mock.jwt.token'),
}));

const { pool } = require('../../src/models/db');

afterEach(() => jest.clearAllMocks());

// ── 工具函数 ──────────────────────────────────────────────────────
const futureDeadline = () => new Date(Date.now() + 3600 * 1000).toISOString();

const mockConn = () => {
  const conn = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
  pool.getConnection.mockResolvedValue(conn);
  return conn;
};

// ── POST /api/sessions ────────────────────────────────────────────
describe('POST /api/sessions', () => {
  const validBody = {
    selectedRestaurantIds: [1, 2, 3],
    deadlineAt: futureDeadline(),
  };

  test('AC1 — 正常创建 → 201 + shareToken + deadlineAt', async () => {
    // pool.query: 验证餐厅归属
    pool.query.mockResolvedValueOnce([[
      { id: 1, name: '餐厅A', category: '中餐' },
      { id: 2, name: '餐厅B', category: '西餐' },
      { id: 3, name: '餐厅C', category: '日料' },
    ]]);

    const conn = mockConn();
    conn.query
      .mockResolvedValueOnce([{ insertId: 10 }])          // INSERT decision_sessions
      .mockResolvedValueOnce([[{ name: '测试用户' }]])      // SELECT users
      .mockResolvedValueOnce([{}]);                         // INSERT session_participants

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', 'Bearer mock.token')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({
      sessionId: 10,
      deadlineAt: expect.any(String),
      expiresAt: expect.any(String),
      shareToken: expect.any(String),
    });
  });

  test('AC2 — selectedRestaurantIds 少于2家 → 400 code:40002', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', 'Bearer mock.token')
      .send({ selectedRestaurantIds: [1], deadlineAt: futureDeadline() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40002);
  });

  test('AC3 — selectedRestaurantIds 超过20家 → 400 code:40004', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => i + 1);
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', 'Bearer mock.token')
      .send({ selectedRestaurantIds: ids, deadlineAt: futureDeadline() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40004);
  });

  test('AC4 — deadlineAt 早于当前时间 → 400 code:40003', async () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString();
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', 'Bearer mock.token')
      .send({ selectedRestaurantIds: [1, 2], deadlineAt: pastDeadline });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40003);
  });

  test('AC4 — deadlineAt 为空 → 400 code:40003', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', 'Bearer mock.token')
      .send({ selectedRestaurantIds: [1, 2] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40003);
  });

  test('AC5 — 含不属于用户的餐厅ID → 400 code:40005', async () => {
    // 只返回2条，但请求了3条 → 有无效ID
    pool.query.mockResolvedValueOnce([[
      { id: 1, name: '餐厅A', category: '中餐' },
      { id: 2, name: '餐厅B', category: '西餐' },
    ]]);

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', 'Bearer mock.token')
      .send({ selectedRestaurantIds: [1, 2, 999], deadlineAt: futureDeadline() });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40005);
  });

  test('未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send(validBody);

    expect(res.status).toBe(401);
  });

  test('candidate_snapshot 不含权重展开（仅原始餐厅列表）', async () => {
    pool.query.mockResolvedValueOnce([[
      { id: 1, name: '餐厅A', category: '中餐' },
      { id: 2, name: '餐厅B', category: '西餐' },
    ]]);

    const conn = mockConn();
    let capturedSnapshot;
    conn.query
      .mockImplementationOnce((sql, params) => {
        capturedSnapshot = JSON.parse(params[2]); // candidate_snapshot 是第3个参数
        return Promise.resolve([{ insertId: 5 }]);
      })
      .mockResolvedValueOnce([[{ name: '用户' }]])
      .mockResolvedValueOnce([{}]);

    await request(app)
      .post('/api/sessions')
      .set('Authorization', 'Bearer mock.token')
      .send({ selectedRestaurantIds: [1, 2], deadlineAt: futureDeadline() });

    // snapshot 长度应等于选择的餐厅数量（不展开权重）
    expect(capturedSnapshot).toHaveLength(2);
    expect(capturedSnapshot[0]).toMatchObject({ id: 1, name: '餐厅A' });
    expect(capturedSnapshot[1]).toMatchObject({ id: 2, name: '餐厅B' });
  });
});
