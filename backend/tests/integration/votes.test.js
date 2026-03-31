/**
 * 投票 API 集成测试
 * Story: 6.9-new
 * POST /api/sessions/:token/vote
 * POST /api/sessions/:token/close-vote
 * GET  /api/sessions/:token/votes
 */

const request = require('supertest');
const app     = require('../../src/app');

jest.mock('../../src/models/db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/websocket/server', () => ({
  broadcast:        jest.fn(),
  broadcastExcept:  jest.fn(),
  rooms:            new Map(),
  startSpinRound:   jest.fn(),
  initVoteRound:    jest.fn(),
  recordVote:       jest.fn().mockReturnValue('ok'),
  closeVoteRound:   jest.fn().mockReturnValue(true),
  getVotesSummary:  jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ userId: 1 }),
  sign:   jest.fn().mockReturnValue('mock.jwt.token'),
}));

const { pool } = require('../../src/models/db');
const wsServer  = require('../../src/websocket/server');

afterEach(() => jest.clearAllMocks());

// ── POST /api/sessions/:token/vote ────────────────────────────────
describe('POST /api/sessions/:token/vote', () => {
  const validBody = { restaurantId: 1, restaurantName: '餐厅A' };

  test('AC1 — 正常投票 → 200 voted:true', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'deciding' }]]);
    wsServer.recordVote.mockReturnValueOnce('ok');

    const res = await request(app)
      .post('/api/sessions/tok123/vote')
      .set('Authorization', 'Bearer mock.token')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.voted).toBe(true);
  });

  test('AC2 — 会话不存在 → 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // no session

    const res = await request(app)
      .post('/api/sessions/bad_token/vote')
      .set('Authorization', 'Bearer mock.token')
      .send(validBody);

    expect(res.status).toBe(404);
  });

  test('AC3 — 会话非 deciding 状态 → 400 code:40003', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'waiting' }]]);

    const res = await request(app)
      .post('/api/sessions/tok123/vote')
      .set('Authorization', 'Bearer mock.token')
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40003);
  });

  test('AC4 — restaurantName 为空 → 400 code:40001', async () => {
    const res = await request(app)
      .post('/api/sessions/tok123/vote')
      .set('Authorization', 'Bearer mock.token')
      .send({ restaurantId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  test('AC5 — voteRound 不存在 → 400 code:40003', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'deciding' }]]);
    wsServer.recordVote.mockReturnValueOnce('no_round');

    const res = await request(app)
      .post('/api/sessions/tok123/vote')
      .set('Authorization', 'Bearer mock.token')
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40003);
  });
});

// ── POST /api/sessions/:token/close-vote ──────────────────────────
describe('POST /api/sessions/:token/close-vote', () => {
  test('AC1 — 发起人关闭投票 → 200 closed:true', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'deciding', host_user_id: 1 }]]);
    wsServer.closeVoteRound.mockReturnValueOnce(true);

    const res = await request(app)
      .post('/api/sessions/tok123/close-vote')
      .set('Authorization', 'Bearer mock.token');

    expect(res.status).toBe(200);
    expect(res.body.data.closed).toBe(true);
  });

  test('AC2 — 非发起人 → 403', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'deciding', host_user_id: 99 }]]);

    const res = await request(app)
      .post('/api/sessions/tok123/close-vote')
      .set('Authorization', 'Bearer mock.token');

    expect(res.status).toBe(403);
  });

  test('AC3 — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/sessions/tok123/close-vote');

    expect(res.status).toBe(401);
  });

  test('AC4 — 会话非 deciding → 400', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'done', host_user_id: 1 }]]);

    const res = await request(app)
      .post('/api/sessions/tok123/close-vote')
      .set('Authorization', 'Bearer mock.token');

    expect(res.status).toBe(400);
  });
});

// ── GET /api/sessions/:token/votes ────────────────────────────────
describe('GET /api/sessions/:token/votes', () => {
  test('AC1 — 返回当前票数', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'deciding' }]]);
    wsServer.getVotesSummary.mockReturnValueOnce({
      votes: [
        { restaurantId: 1, restaurantName: '餐厅A', count: 2 },
        { restaurantId: 2, restaurantName: '餐厅B', count: 1 },
      ],
      totalVoters: 3,
      votedCount: 3,
    });

    const res = await request(app).get('/api/sessions/tok123/votes');

    expect(res.status).toBe(200);
    expect(res.body.data.votes).toHaveLength(2);
    expect(res.body.data.totalVoters).toBe(3);
  });

  test('AC2 — 投票未开始（no round）→ 空数组', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, status: 'deciding' }]]);
    wsServer.getVotesSummary.mockReturnValueOnce(null);

    const res = await request(app).get('/api/sessions/tok123/votes');

    expect(res.status).toBe(200);
    expect(res.body.data.votes).toEqual([]);
    expect(res.body.data.votedCount).toBe(0);
  });

  test('AC3 — 会话不存在 → 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // no session

    const res = await request(app).get('/api/sessions/bad_token/votes');

    expect(res.status).toBe(404);
  });
});
