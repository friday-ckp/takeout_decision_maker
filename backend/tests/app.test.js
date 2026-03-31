/**
 * Story 1.3 验收测试脚手架（更新 Story 8.4：X-User-Id → JWT Bearer Token）
 * 测试后端骨架：统一响应格式、X-Request-Id、auth 中间件、错误处理
 */
const request = require('supertest');

// Mock DB 连接，避免测试需要真实数据库
jest.mock('../src/models/db', () => ({
  pool: {},
  testConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
}));

const app = require('../src/app');

describe('后端骨架', () => {
  test('GET /api/health 返回统一响应格式', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('code', 0);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('data');
  });

  test('响应头包含 X-Request-Id', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test('缺少 Authorization 时返回 401/40101', async () => {
    const { requireAuth } = require('../src/middleware/auth');
    const mockReq = { headers: {} };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(mockReq, mockRes, next);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      code: 40101,
      message: '未登录',
      data: null,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('有效 Bearer Token 时 auth 中间件放行', () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockReturnValueOnce({ userId: 1 });

    const { requireAuth } = require('../src/middleware/auth');
    const mockReq = { headers: { authorization: 'Bearer valid.token' } };
    const mockRes = {};
    const next = jest.fn();

    requireAuth(mockReq, mockRes, next);

    expect(next).toHaveBeenCalled();
    expect(mockReq.userId).toBe(1);
  });

  test('过期 Token 返回 401/40102', () => {
    const jwt = require('jsonwebtoken');
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';
    jwt.verify.mockImplementationOnce(() => { throw expiredError; });

    const { requireAuth } = require('../src/middleware/auth');
    const mockReq = { headers: { authorization: 'Bearer expired.token' } };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(mockReq, mockRes, next);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      code: 40102,
      message: '登录已过期，请重新登录',
      data: null,
    });
  });
});
