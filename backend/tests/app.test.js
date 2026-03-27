/**
 * Story 1.3 验收测试脚手架
 * 测试后端骨架：统一响应格式、X-Request-Id、auth 中间件、错误处理
 */
const request = require('supertest');

// Mock DB 连接，避免测试需要真实数据库
jest.mock('../src/models/db', () => ({
  pool: {},
  testConnection: jest.fn().mockResolvedValue(true),
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

  test('缺少 X-User-Id 时返回 40001', async () => {
    // 临时挂载一个需要 auth 的测试路由
    const express = require('express');
    const testApp = require('../src/app');
    const { requireUserId } = require('../src/middleware/auth');

    // 直接测试 auth 中间件
    const mockReq = { headers: {} };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    requireUserId(mockReq, mockRes, next);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      code: 40001,
      message: '缺少 X-User-Id',
      data: null,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('有 X-User-Id 时 auth 中间件放行', () => {
    const { requireUserId } = require('../src/middleware/auth');
    const mockReq = { headers: { 'x-user-id': '1' } };
    const mockRes = {};
    const next = jest.fn();

    requireUserId(mockReq, mockRes, next);

    expect(next).toHaveBeenCalled();
    expect(mockReq.userId).toBe(1);
  });
});
