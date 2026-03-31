/**
 * 餐厅 CRUD + 收藏/拉黑 集成测试
 * Stories: 1.5, 1.8, 1.10, 1.12, 1.13, 1.15, 1.16, 1.17, 1.18
 *
 * 策略：mock pool.query，测试 HTTP 接口行为
 */

const request = require('supertest');
const app     = require('../../src/app');

// ── Mock DB ───────────────────────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  pool: { query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(),
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn().mockReturnValue({ userId: 1 }) }));

const { pool } = require('../../src/models/db');

const USER_HEADER = { 'Authorization': 'Bearer test.token' };

afterEach(() => jest.clearAllMocks());

// ── GET /api/restaurants ──────────────────────────────────────────────────
describe('GET /api/restaurants', () => {
  test('返回餐厅列表', async () => {
    pool.query.mockResolvedValueOnce([[
      { id: 1, name: '麦当劳', category: '快餐', tags: '["快餐"]', notes: '', createdAt: new Date(), updatedAt: new Date(), isFavorite: 0 },
      { id: 2, name: '肯德基', category: '快餐', tags: '[]', notes: '', createdAt: new Date(), updatedAt: new Date(), isFavorite: 1 },
    ]]);

    const res = await request(app).get('/api/restaurants').set(USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.list).toHaveLength(2);
    expect(res.body.data.list[0].name).toBe('麦当劳');
    expect(res.body.data.list[1].isFavorite).toBe(true);
  });

  test('缺少 Authorization 返回 401', async () => {
    const res = await request(app).get('/api/restaurants');
    expect(res.status).toBe(401);
  });

  test('keyword 过滤正确传参', async () => {
    pool.query.mockResolvedValueOnce([[
      { id: 1, name: '麦当劳', category: null, tags: '[]', notes: '', createdAt: new Date(), updatedAt: new Date(), isFavorite: 0 },
    ]]);
    const res = await request(app).get('/api/restaurants?keyword=麦当').set(USER_HEADER);
    expect(res.status).toBe(200);
    // 验证 query 被调用且包含 keyword 参数
    const callArgs = pool.query.mock.calls[0];
    expect(callArgs[1]).toContain('%麦当%');
  });
});

// ── POST /api/restaurants ─────────────────────────────────────────────────
describe('POST /api/restaurants', () => {
  test('创建餐厅成功返回 201', async () => {
    pool.query
      .mockResolvedValueOnce([[]])           // 同名检查：无重复
      .mockResolvedValueOnce([{ insertId: 99 }])  // INSERT
      .mockResolvedValueOnce([[{            // SELECT 新记录
        id: 99, name: '新餐厅', category: '中餐', tags: '["川菜"]',
        notes: '好吃', createdAt: new Date(), updatedAt: new Date(),
      }]]);

    const res = await request(app)
      .post('/api/restaurants')
      .set(USER_HEADER)
      .send({ name: '新餐厅', category: '中餐', tags: ['川菜'], notes: '好吃' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.name).toBe('新餐厅');
    expect(res.body.data.tags).toEqual(['川菜']);
  });

  test('名称为空返回 400', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set(USER_HEADER)
      .send({ name: '', category: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  test('名称超过 100 字符返回 400', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set(USER_HEADER)
      .send({ name: 'A'.repeat(101) });
    expect(res.status).toBe(400);
  });

  test('tags 超过 10 个返回 400', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set(USER_HEADER)
      .send({ name: '测试', tags: Array(11).fill('tag') });
    expect(res.status).toBe(400);
  });

  test('同名餐厅返回 409', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // 同名已存在
    const res = await request(app)
      .post('/api/restaurants')
      .set(USER_HEADER)
      .send({ name: '已有餐厅', tags: [] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(40901);
  });

  test('tags 非数组返回 400', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set(USER_HEADER)
      .send({ name: '测试', tags: '非数组' });
    expect(res.status).toBe(400);
  });
});

// ── PUT /api/restaurants/:id ──────────────────────────────────────────────
describe('PUT /api/restaurants/:id', () => {
  test('编辑餐厅成功', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])  // 存在性检查
      .mockResolvedValueOnce([[]])            // 同名检查
      .mockResolvedValueOnce([{}])            // UPDATE
      .mockResolvedValueOnce([[{             // SELECT 更新后记录
        id: 1, name: '新名称', category: '日料', tags: '["寿司"]',
        notes: '', createdAt: new Date(), updatedAt: new Date(), isFavorite: 0,
      }]]);

    const res = await request(app)
      .put('/api/restaurants/1')
      .set(USER_HEADER)
      .send({ name: '新名称', category: '日料', tags: ['寿司'], notes: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('新名称');
  });

  test('餐厅不存在返回 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 不存在
    const res = await request(app)
      .put('/api/restaurants/999')
      .set(USER_HEADER)
      .send({ name: '改名', tags: [] });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/restaurants/:id ───────────────────────────────────────────
describe('DELETE /api/restaurants/:id (软删除)', () => {
  test('删除成功', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])  // 存在性检查
      .mockResolvedValueOnce([{}]);           // UPDATE

    const res = await request(app)
      .delete('/api/restaurants/1')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });

  test('不存在的餐厅返回 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 不存在
    const res = await request(app)
      .delete('/api/restaurants/999')
      .set(USER_HEADER);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/restaurants/trash ────────────────────────────────────────────
describe('GET /api/restaurants/trash', () => {
  test('返回回收站列表', async () => {
    pool.query.mockResolvedValueOnce([[
      { id: 5, name: '已删餐厅', category: null, tags: '[]', notes: '', deletedAt: new Date() },
    ]]);
    const res = await request(app).get('/api/restaurants/trash').set(USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].name).toBe('已删餐厅');
  });
});

// ── POST /api/restaurants/:id/restore ────────────────────────────────────
describe('POST /api/restaurants/:id/restore', () => {
  test('还原成功', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5 }]])  // 在回收站
      .mockResolvedValueOnce([{}]);           // UPDATE

    const res = await request(app)
      .post('/api/restaurants/5/restore')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(5);
  });

  test('不在回收站返回 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 不存在
    const res = await request(app)
      .post('/api/restaurants/999/restore')
      .set(USER_HEADER);
    expect(res.status).toBe(404);
  });
});

// ── POST /api/restaurants/import ─────────────────────────────────────────
describe('POST /api/restaurants/import', () => {
  test('批量导入成功', async () => {
    // 2 条导入，每条需要：同名查询 + INSERT
    pool.query
      .mockResolvedValueOnce([[]])       // 第1条同名检查
      .mockResolvedValueOnce([{}])       // 第1条 INSERT
      .mockResolvedValueOnce([[]])       // 第2条同名检查
      .mockResolvedValueOnce([{}]);      // 第2条 INSERT

    const res = await request(app)
      .post('/api/restaurants/import')
      .set(USER_HEADER)
      .send({ restaurants: [
        { name: '餐厅A', category: '中餐', tags: [] },
        { name: '餐厅B', category: '西餐', tags: ['汉堡'] },
      ]});

    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.skipped).toBe(0);
  });

  test('跳过同名餐厅', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])  // 第1条已存在 → 跳过
      .mockResolvedValueOnce([[]])            // 第2条不存在
      .mockResolvedValueOnce([{}]);           // 第2条 INSERT

    const res = await request(app)
      .post('/api/restaurants/import')
      .set(USER_HEADER)
      .send({ restaurants: [
        { name: '已有餐厅' },
        { name: '新餐厅' },
      ]});

    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.skipped).toBe(1);
  });

  test('超过 200 条返回 400', async () => {
    const res = await request(app)
      .post('/api/restaurants/import')
      .set(USER_HEADER)
      .send({ restaurants: Array(201).fill({ name: '餐厅' }) });
    expect(res.status).toBe(400);
  });

  test('空数组返回 400', async () => {
    const res = await request(app)
      .post('/api/restaurants/import')
      .set(USER_HEADER)
      .send({ restaurants: [] });
    expect(res.status).toBe(400);
  });

  test('名称为空的条目计入 skipped', async () => {
    pool.query
      .mockResolvedValueOnce([[]])  // 有效条目同名检查
      .mockResolvedValueOnce([{}]); // 有效条目 INSERT

    const res = await request(app)
      .post('/api/restaurants/import')
      .set(USER_HEADER)
      .send({ restaurants: [
        { name: '' },            // 空名 → skipped
        { name: '有效餐厅' },    // 成功
      ]});

    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].index).toBe(0);
  });
});

// ── POST /api/restaurants/:id/favorite ───────────────────────────────────
describe('POST /api/restaurants/:id/favorite (收藏/取消收藏)', () => {
  test('新增收藏', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])  // 存在性检查
      .mockResolvedValueOnce([[]])            // 无已有关系
      .mockResolvedValueOnce([{}]);           // INSERT relation

    const res = await request(app)
      .post('/api/restaurants/1/favorite')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.isFavorite).toBe(true);
  });

  test('取消收藏', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])            // 存在性检查
      .mockResolvedValueOnce([[{ id: 10 }]])            // 已有关系存在
      .mockResolvedValueOnce([[{ relation_type: 'favorite' }]])  // 当前是收藏
      .mockResolvedValueOnce([{}]);                    // DELETE

    const res = await request(app)
      .post('/api/restaurants/1/favorite')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.isFavorite).toBe(false);
  });

  test('已拉黑状态尝试收藏返回 409', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])  // 存在性检查
      .mockResolvedValueOnce([[{ id: 10 }]]) // 已有关系
      .mockResolvedValueOnce([[{ relation_type: 'blocked' }]]); // 当前是拉黑

    const res = await request(app)
      .post('/api/restaurants/1/favorite')
      .set(USER_HEADER);

    expect(res.status).toBe(409);
  });

  test('餐厅不存在返回 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // 不存在
    const res = await request(app)
      .post('/api/restaurants/999/favorite')
      .set(USER_HEADER);
    expect(res.status).toBe(404);
  });
});

// ── POST /api/restaurants/:id/block ──────────────────────────────────────
describe('POST /api/restaurants/:id/block (拉黑/解除拉黑)', () => {
  test('新增拉黑', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])  // 存在性检查
      .mockResolvedValueOnce([[]])            // 无已有关系
      .mockResolvedValueOnce([{}]);           // INSERT

    const res = await request(app)
      .post('/api/restaurants/1/block')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.isBlocked).toBe(true);
  });

  test('解除拉黑', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])                    // 存在性检查
      .mockResolvedValueOnce([[{ id: 10, relation_type: 'blocked' }]])  // 已拉黑
      .mockResolvedValueOnce([{}]);                            // DELETE

    const res = await request(app)
      .post('/api/restaurants/1/block')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.isBlocked).toBe(false);
  });

  test('从收藏转为拉黑', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])                        // 存在性检查
      .mockResolvedValueOnce([[{ id: 10, relation_type: 'favorite' }]]) // 当前收藏
      .mockResolvedValueOnce([{}]);                                // UPDATE

    const res = await request(app)
      .post('/api/restaurants/1/block')
      .set(USER_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.isBlocked).toBe(true);
  });
});

// ── GET /api/restaurants/blacklist ────────────────────────────────────────
describe('GET /api/restaurants/blacklist', () => {
  test('返回黑名单列表', async () => {
    pool.query.mockResolvedValueOnce([[
      { id: 2, name: '踩过的餐厅', category: null, tags: '[]', notes: '', blockedAt: new Date() },
    ]]);
    const res = await request(app).get('/api/restaurants/blacklist').set(USER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });
});
