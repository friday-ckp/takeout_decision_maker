/**
 * 用户认证 API 集成测试
 * Story: 8.2, 8.3
 * POST /api/auth/register — 用户注册
 * POST /api/auth/login    — 用户登录
 */

const request = require('supertest');
const app     = require('../../src/app');

jest.mock('../../src/models/db', () => ({
  pool: { query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
}));

const { pool } = require('../../src/models/db');
const bcrypt = require('bcryptjs');

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

// ── POST /api/auth/login ──────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  const validLogin = { email: 'test@example.com', password: 'password123' };
  const mockUser = { id: 1, name: '测试用户', email: 'test@example.com', password_hash: 'hashed' };

  test('正确凭据 → 200 + token + userId + name', async () => {
    pool.query.mockResolvedValueOnce([[mockUser]]);
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send(validLogin);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toMatchObject({
      token: 'mock.jwt.token',
      userId: 1,
      name: '测试用户',
    });
  });

  test('用户不存在 → 401', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 用户不存在

    const res = await request(app)
      .post('/api/auth/login')
      .send(validLogin);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
    expect(res.body.message).toBe('邮箱或密码错误');
  });

  test('密码错误 → 401', async () => {
    pool.query.mockResolvedValueOnce([[mockUser]]);
    bcrypt.compare.mockResolvedValueOnce(false); // 密码不匹配

    const res = await request(app)
      .post('/api/auth/login')
      .send(validLogin);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
  });

  test('缺少 email/password → 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });
});
