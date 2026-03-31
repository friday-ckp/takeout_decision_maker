/**
 * 用户认证 API 集成测试
 * Story: 8.2
 * POST /api/auth/register — 用户注册
 */

const request = require('supertest');
const app     = require('../../src/app');

jest.mock('../../src/models/db', () => ({
  pool: { query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
}));

const { pool } = require('../../src/models/db');

afterEach(() => jest.clearAllMocks());

// ── POST /api/auth/register ───────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  const validBody = { name: '测试用户', email: 'test@example.com', password: 'password123' };

  test('正常注册 → 201 + token + userId', async () => {
    pool.query
      .mockResolvedValueOnce([[]])           // email 不存在
      .mockResolvedValueOnce([{ insertId: 42 }]); // INSERT 成功

    const res = await request(app)
      .post('/api/auth/register')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({
      userId: 42,
      name: '测试用户',
      email: 'test@example.com',
      token: 'mock.jwt.token',
    });
  });

  test('邮箱已注册 → 409', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // email 已存在

    const res = await request(app)
      .post('/api/auth/register')
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(40901);
    expect(res.body.message).toBe('邮箱已被注册');
  });

  test('邮箱格式错误 → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  test('密码少于8位 → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, password: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40002);
  });

  test('name 为空 → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40003);
  });
});
