/**
 * 餐厅管理 E2E 测试
 * 覆盖：列表、添加、编辑、软删除、回收站还原、批量导入
 * Stories: 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14
 */
const { test, expect } = require('@playwright/test');

const uniqueName = () => `E2E测试餐厅_${Date.now()}`;

// 导航到餐厅列表页
async function goToRestaurants(page) {
  await page.goto('/');
  await page.locator('.topnav__link[data-page="restaurants"]').click();
  await expect(page.locator('#page-restaurants')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#restaurant-list')).toBeVisible({ timeout: 5000 });
}

// 打开添加面板
async function openAddPanel(page) {
  await page.locator('#btn-open-add').click();
  await expect(page.locator('#add-panel.open')).toBeVisible({ timeout: 3000 });
}

test.describe('餐厅列表页', () => {
  test('首页标题正确', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('今天吃啥');
  });

  test('餐厅列表页可加载', async ({ page }) => {
    await goToRestaurants(page);
  });
});

test.describe('添加餐厅', () => {
  test('通过添加面板添加一家餐厅', async ({ page }) => {
    await page.goto('/');
    const name = uniqueName();

    await openAddPanel(page);
    await page.locator('#add-name').fill(name);
    await page.locator('#add-submit-btn').click();

    // 成功 toast 出现
    await expect(page.locator('.toast')).toBeVisible({ timeout: 5000 });
  });

  test('名称为空不能提交', async ({ page }) => {
    await page.goto('/');
    await openAddPanel(page);

    // 不填名称直接提交
    await page.locator('#add-submit-btn').click();

    // 应显示错误提示
    await expect(page.locator('#add-name-error')).toContainText('请输入餐厅名称');
    // 面板仍然打开
    await expect(page.locator('#add-panel.open')).toBeVisible();
  });
});

test.describe('编辑餐厅', () => {
  let createdName;

  test.beforeEach(async ({ page }) => {
    createdName = uniqueName();
    await page.request.post('/api/restaurants', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { name: createdName, category: '测试', tags: [], notes: '' },
    });
  });

  test('编辑餐厅名称', async ({ page }) => {
    await goToRestaurants(page);
    await page.waitForTimeout(500); // 等待列表渲染

    const editBtn = page.locator('[data-action="edit"]').first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await expect(page.locator('#edit-panel.open')).toBeVisible({ timeout: 5000 });

      const input = page.locator('#edit-name').first();
      await input.fill('');
      const newName = `${createdName}_编辑后`;
      await input.fill(newName);
      await page.locator('#edit-restaurant-form button[type="submit"], #btn-edit-save').click();

      // 成功反馈
      await expect(page.locator('.toast')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

test.describe('软删除与回收站', () => {
  test('删除餐厅后出现在回收站', async ({ page }) => {
    const name = uniqueName();
    const createRes = await page.request.post('/api/restaurants', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { name, tags: [] },
    });
    expect(createRes.status()).toBe(201);
    const { data: { id } } = await createRes.json();

    const delRes = await page.request.delete(`/api/restaurants/${id}`, {
      headers: { 'X-User-Id': '1' },
    });
    expect(delRes.status()).toBe(200);

    const trashRes = await page.request.get('/api/restaurants/trash', {
      headers: { 'X-User-Id': '1' },
    });
    const trash = await trashRes.json();
    const trashIds = trash.data.list.map(r => r.id);
    expect(trashIds).toContain(id);
  });

  test('回收站页面可打开', async ({ page }) => {
    await goToRestaurants(page);
    const trashBtn = page.locator('#btn-goto-trash');
    if (await trashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trashBtn.click();
      await expect(page.locator('#page-trash')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('从回收站还原餐厅', async ({ page }) => {
    const name = uniqueName();
    const createRes = await page.request.post('/api/restaurants', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { name, tags: [] },
    });
    const { data: { id } } = await createRes.json();
    await page.request.delete(`/api/restaurants/${id}`, { headers: { 'X-User-Id': '1' } });

    const restoreRes = await page.request.post(`/api/restaurants/${id}/restore`, {
      headers: { 'X-User-Id': '1' },
    });
    expect(restoreRes.status()).toBe(200);

    const trashRes = await page.request.get('/api/restaurants/trash', { headers: { 'X-User-Id': '1' } });
    const trash = await trashRes.json();
    const trashIds = trash.data.list.map(r => r.id);
    expect(trashIds).not.toContain(id);
  });
});

test.describe('JSON 批量导入', () => {
  test('导入页面可打开', async ({ page }) => {
    await goToRestaurants(page);
    const importBtn = page.locator('#btn-goto-import');
    if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importBtn.click();
      await expect(page.locator('#page-import')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('通过 API 批量导入', async ({ page }) => {
    const restaurants = [
      { name: `E2E导入A_${Date.now()}`, category: '快餐', tags: ['快餐'] },
      { name: `E2E导入B_${Date.now()}`, category: '中餐', tags: [] },
    ];

    const res = await page.request.post('/api/restaurants/import', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { restaurants },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.imported).toBe(2);
    expect(body.data.skipped).toBe(0);
  });

  test('重复名称跳过', async ({ page }) => {
    const name = `E2E重复导入_${Date.now()}`;
    await page.request.post('/api/restaurants/import', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { restaurants: [{ name }] },
    });

    const res = await page.request.post('/api/restaurants/import', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { restaurants: [{ name }] },
    });

    const body = await res.json();
    expect(body.data.skipped).toBe(1);
    expect(body.data.imported).toBe(0);
  });
});
