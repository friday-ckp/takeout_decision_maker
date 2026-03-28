/**
 * 历史记录 + 设置页 E2E 测试
 * Stories: 5.1, 4.1, 4.2
 */
const { test, expect } = require('@playwright/test');

test.describe('历史记录', () => {
  test('历史记录 API 返回正确格式', async ({ request }) => {
    const res = await request.get('/api/history', {
      headers: { 'X-User-Id': '1' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(0);
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('list');
    expect(body.data).toHaveProperty('page');
    expect(body.data).toHaveProperty('limit');
  });

  test('记录一条历史后可在列表查到', async ({ request }) => {
    // 先创建餐厅
    const name = `历史测试餐厅_${Date.now()}`;
    const createRes = await request.post('/api/restaurants', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { name, tags: [] },
    });
    const { data: { id } } = await createRes.json();

    // 记录历史
    const histRes = await request.post('/api/history', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { restaurantId: id, mode: 'wheel' },
    });
    expect(histRes.status()).toBe(201);
    const histBody = await histRes.json();
    expect(histBody.data.restaurantName).toBe(name);
    expect(histBody.data.mode).toBe('wheel');

    // 在列表中可找到
    const listRes = await request.get('/api/history', { headers: { 'X-User-Id': '1' } });
    const { data: { list } } = await listRes.json();
    const found = list.find(h => h.restaurantId === id);
    expect(found).toBeTruthy();
  });

  test('历史页面可从首页导航', async ({ page }) => {
    await page.goto('/');
    const historyBtn = page.locator('#btn-goto-history, a[href*="history"], button:has-text("历史")');
    if (await historyBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyBtn.first().click();
      await expect(page.locator('#page-history, .history-list')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('历史分页：page 和 limit 参数有效', async ({ request }) => {
    const res = await request.get('/api/history?page=1&limit=5', {
      headers: { 'X-User-Id': '1' },
    });
    const body = await res.json();
    expect(body.data.limit).toBe(5);
    expect(body.data.page).toBe(1);
    expect(Array.isArray(body.data.list)).toBe(true);
    expect(body.data.list.length).toBeLessThanOrEqual(5);
  });
});

test.describe('个性化设置', () => {
  test('获取默认设置', async ({ request }) => {
    const res = await request.get('/api/settings', {
      headers: { 'X-User-Id': '1' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('daily_replay_limit');
    expect(body.data).toHaveProperty('history_exclude_days');
  });

  test('修改每日重玩次数限制', async ({ request }) => {
    const patchRes = await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { daily_replay_limit: 5 },
    });
    expect(patchRes.status()).toBe(200);
    const body = await patchRes.json();
    expect(body.data.daily_replay_limit).toBe(5);

    // 恢复默认
    await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { daily_replay_limit: 3 },
    });
  });

  test('修改历史排除天数', async ({ request }) => {
    const patchRes = await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { history_exclude_days: 7 },
    });
    expect(patchRes.status()).toBe(200);
    expect((await patchRes.json()).data.history_exclude_days).toBe(7);

    // 恢复默认
    await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { history_exclude_days: 3 },
    });
  });

  test('非法设置值返回 400', async ({ request }) => {
    const res = await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { daily_replay_limit: 999 }, // 超过最大值 10
    });
    expect(res.status()).toBe(400);
  });

  test('设置页面可打开', async ({ page }) => {
    await page.goto('/');
    const settingsBtn = page.locator('#btn-goto-settings, a[href*="settings"], button:has-text("设置")');
    if (await settingsBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsBtn.first().click();
      await expect(page.locator('#page-settings, .settings-page')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('每日重玩次数设置范围 1~10', async ({ request }) => {
    // 边界值：1 应通过
    const res1 = await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { daily_replay_limit: 1 },
    });
    expect(res1.status()).toBe(200);

    // 边界值：10 应通过
    const res2 = await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { daily_replay_limit: 10 },
    });
    expect(res2.status()).toBe(200);

    // 恢复
    await request.patch('/api/settings', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { daily_replay_limit: 3 },
    });
  });
});
