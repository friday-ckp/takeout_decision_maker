/**
 * 多人结果页 API 集成测试
 * Story: 6.11-v2
 * POST /api/sessions/:token/confirm  (requireAuth + host check)
 * POST /api/sessions/:token/replay   (requireAuth + initVoteRound reset)
 */

const request = require('supertest');
const app     = require('../../src/app');

jest.mock('../../src/models/db', () => ({
  pool: {
    query: jest.fn(),
    getConnection: jest.fn(),
  },
  testConnection: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/websocket/server', () => ({
  broadcast:       jest.fn(),
  broadcastExcept: jest.fn(),
  rooms:           new Map(),
  startSpinRound:  jest.fn(),
  initVoteRound:   jest.fn(),
  recordVote:      jest.fn(),
  closeVoteRound:  jest.fn(),
  getVotesSummary: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 1 }),
  sign:   jest.fn().mockReturnValue('mock.jwt.token'),
}));

const { pool }   = require('../../src/models/db');
const wsServer   = require('../../src/websocket/server');

afterEach(() => jest.clearAllMocks());

// ── POST /api/sessions/:token/confirm ─────────────────────────────
describe('POST /api/sessions/:token/confirm', () => {
  const body = { resultRestaurantId: 1, resultRestaurantName: '好吃餐厅' };

  test('AC1 — 未携带 token → 401', async () => {
    const res = await request(app)
      .post('/api/sessions/tok/confirm')
      .send(body);
    expect(res.status).toBe(401);
  });

  test('AC2 — 发起人确认 → 200, broadcast session_done', async () => {
    const mockConn = {
      beginTransaction: jest.fn(),
      query:            jest.fn().mockResolvedValue([]),
      commit:           jest.fn(),
      rollback:         jest.fn(),
      release:          jest.fn(),
    };
    pool.getConnection.mockResolvedValueOnce(mockConn);
    pool.query
      .mockResolvedValueOnce([[{ id: 10, status: 'deciding', host_user_id: 1 }]])  // SELECT session
      .mockResolvedValueOnce([[{ user_id: 2 }, { user_id: 3 }]]);                  // SELECT participants

    const res = await request(app)
      .post('/api/sessions/tok/confirm')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send(body);

    expect(res.status).toBe(200);
    expect(wsServer.broadcast).toHaveBeenCalledWith('tok', expect.objectContaining({
      event: 'session_done',
      data:  expect.objectContaining({ resultRestaurantName: '好吃餐厅' }),
    }));
  });

  test('AC3 — 非发起人调用 → 403', async () => {
    // userId=1, but host_user_id=99
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'deciding', host_user_id: 99 }]]);

    const res = await request(app)
      .post('/api/sessions/tok/confirm')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send(body);

    expect(res.status).toBe(403);
  });

  test('AC4 — 会话不存在 → 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // empty result

    const res = await request(app)
      .post('/api/sessions/noexist/confirm')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send(body);

    expect(res.status).toBe(404);
  });

  test('AC5 — resultRestaurantName 为空 → 400', async () => {
    const res = await request(app)
      .post('/api/sessions/tok/confirm')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send({ resultRestaurantId: 1 });  // missing name

    expect(res.status).toBe(400);
  });

  test('AC6 — 事务失败 → 500，rollback 调用', async () => {
    const mockConn = {
      beginTransaction: jest.fn(),
      query:            jest.fn().mockRejectedValueOnce(new Error('DB error')),
      commit:           jest.fn(),
      rollback:         jest.fn(),
      release:          jest.fn(),
    };
    pool.getConnection.mockResolvedValueOnce(mockConn);
    pool.query
      .mockResolvedValueOnce([[{ id: 10, status: 'deciding', host_user_id: 1 }]])
      .mockResolvedValueOnce([[{ user_id: 2 }]]);

    const res = await request(app)
      .post('/api/sessions/tok/confirm')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send(body);

    expect(res.status).toBe(500);
    expect(mockConn.rollback).toHaveBeenCalled();
  });
});

// ── POST /api/sessions/:token/replay ──────────────────────────────
describe('POST /api/sessions/:token/replay', () => {
  const mkSession = (opts = {}) => ({
    id: 10,
    status: 'deciding',
    host_user_id: 1,
    candidate_snapshot: JSON.stringify([{ id: 1, name: '餐厅A' }]),
    deadline_at: null,
    ...opts,
  });

  test('AC1 — 未携带 token → 401', async () => {
    const res = await request(app).post('/api/sessions/tok/replay').send({});
    expect(res.status).toBe(401);
  });

  test('AC2 — 正常重玩 → 200, initVoteRound 重置, broadcast replay_initiated', async () => {
    pool.query
      .mockResolvedValueOnce([[mkSession()]])              // SELECT session
      .mockResolvedValueOnce([[]])                         // SELECT daily_config → no record
      .mockResolvedValueOnce([[]])                         // SELECT settings → no record
      .mockResolvedValueOnce([{ affectedRows: 1 }])        // INSERT daily_config
      .mockResolvedValueOnce([{ affectedRows: 1 }])        // UPDATE status → deciding
      .mockResolvedValueOnce([[{ cnt: 3 }]]);              // COUNT participants

    const res = await request(app)
      .post('/api/sessions/tok/replay')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send({});

    expect(res.status).toBe(200);
    expect(wsServer.initVoteRound).toHaveBeenCalledWith(
      'tok', 10, 3, expect.any(Array), null
    );
    expect(wsServer.broadcast).toHaveBeenCalledWith('tok', expect.objectContaining({
      event: 'replay_initiated',
    }));
  });

  test('AC3 — replay_count 达上限 → 400, 不调用 broadcast', async () => {
    pool.query
      .mockResolvedValueOnce([[mkSession()]])
      .mockResolvedValueOnce([[{ replay_count: 3 }]])  // dc = 3
      .mockResolvedValueOnce([[{ value: '3' }]]);       // setting maxReplay = 3

    const res = await request(app)
      .post('/api/sessions/tok/replay')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send({});

    expect(res.status).toBe(400);
    expect(wsServer.broadcast).not.toHaveBeenCalled();
  });

  test('AC4 — 会话不存在 → 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // session not found

    const res = await request(app)
      .post('/api/sessions/notexist/replay')
      .set('Authorization', 'Bearer mock.jwt.token')
      .send({});

    expect(res.status).toBe(404);
  });
});
