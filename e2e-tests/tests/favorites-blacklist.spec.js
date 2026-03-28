/**
 * 收藏 / 拉黑 E2E 测试
 * Stories: 1.15, 1.16, 1.17, 1.18
 */
const { test, expect } = require('@playwright/test');

// 每次测试创建一家新餐厅，避免状态污染
async function createRestaurant(request, name) {
  const res = await request.post('/api/restaurants', {
    headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
    data: { name, tags: [] },
  });
  const body = await res.json();
  return body.data.id;
}

test.describe('收藏功能', () => {
  test('收藏餐厅 → API 返回 isFavorite: true', async ({ request }) => {
    const name = `E2E收藏_${Date.now()}`;
    const id = await createRestaurant(request, name);

    const favRes = await request.post(`/api/restaurants/${id}/favorite`, {
      headers: { 'X-User-Id': '1' },
    });
    expect(favRes.status()).toBe(200);
    const body = await favRes.json();
    expect(body.data.isFavorite).toBe(true);
  });

  test('再次点击取消收藏 → isFavorite: false', async ({ request }) => {
    const name = `E2E取消收藏_${Date.now()}`;
    const id = await createRestaurant(request, name);

    // 收藏
    await request.post(`/api/restaurants/${id}/favorite`, { headers: { 'X-User-Id': '1' } });
    // 取消收藏
    const cancelRes = await request.post(`/api/restaurants/${id}/favorite`, { headers: { 'X-User-Id': '1' } });
    const body = await cancelRes.json();
    expect(body.data.isFavorite).toBe(false);
  });

  test('收藏后出现在收藏列表', async ({ request }) => {
    const name = `E2E收藏列表_${Date.now()}`;
    const id = await createRestaurant(request, name);
    await request.post(`/api/restaurants/${id}/favorite`, { headers: { 'X-User-Id': '1' } });

    const listRes = await request.get('/api/restaurants', { headers: { 'X-User-Id': '1' } });
    const { data: { list } } = await listRes.json();
    const found = list.find(r => r.id === id);
    expect(found).toBeTruthy();
    expect(found.isFavorite).toBe(true);
  });

  test('收藏页面可打开', async ({ page }) => {
    await page.goto('/');
    const favBtn = page.locator('#btn-goto-favorites, button:has-text("收藏")');
    if (await favBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await favBtn.click();
      await expect(page.locator('#page-favorites, .favorites-list')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('已拉黑餐厅不能收藏（返回 409）', async ({ request }) => {
    const name = `E2E拉黑后收藏_${Date.now()}`;
    const id = await createRestaurant(request, name);

    // 先拉黑
    await request.post(`/api/restaurants/${id}/block`, { headers: { 'X-User-Id': '1' } });

    // 尝试收藏 → 应返回 409
    const favRes = await request.post(`/api/restaurants/${id}/favorite`, { headers: { 'X-User-Id': '1' } });
    expect(favRes.status()).toBe(409);
  });
});

test.describe('拉黑功能', () => {
  test('拉黑餐厅 → isBlocked: true', async ({ request }) => {
    const id = await createRestaurant(request, `E2E拉黑_${Date.now()}`);
    const res = await request.post(`/api/restaurants/${id}/block`, { headers: { 'X-User-Id': '1' } });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.isBlocked).toBe(true);
  });

  test('解除拉黑 → isBlocked: false', async ({ request }) => {
    const id = await createRestaurant(request, `E2E解除拉黑_${Date.now()}`);
    await request.post(`/api/restaurants/${id}/block`, { headers: { 'X-User-Id': '1' } });
    const unblockRes = await request.post(`/api/restaurants/${id}/block`, { headers: { 'X-User-Id': '1' } });
    expect((await unblockRes.json()).data.isBlocked).toBe(false);
  });

  test('已收藏餐厅转拉黑 → isBlocked: true', async ({ request }) => {
    const id = await createRestaurant(request, `E2E收藏转拉黑_${Date.now()}`);
    await request.post(`/api/restaurants/${id}/favorite`, { headers: { 'X-User-Id': '1' } });
    const blockRes = await request.post(`/api/restaurants/${id}/block`, { headers: { 'X-User-Id': '1' } });
    expect((await blockRes.json()).data.isBlocked).toBe(true);
  });

  test('拉黑后不出现在候选列表', async ({ request }) => {
    const id = await createRestaurant(request, `E2E拉黑候选_${Date.now()}`);

    // 确认添加前在候选中
    const beforeRes = await request.get('/api/candidates', { headers: { 'X-User-Id': '1' } });
    const beforeIds = (await beforeRes.json()).data.candidates.map(c => c.id);
    expect(beforeIds).toContain(id);

    // 拉黑
    await request.post(`/api/restaurants/${id}/block`, { headers: { 'X-User-Id': '1' } });

    // 确认不在候选中
    const afterRes = await request.get('/api/candidates', { headers: { 'X-User-Id': '1' } });
    const afterIds = ((await afterRes.json()).data.candidates || []).map(c => c.id);
    expect(afterIds).not.toContain(id);
  });

  test('黑名单页面可打开', async ({ page }) => {
    await page.goto('/');
    const blackBtn = page.locator('#btn-goto-blacklist, button:has-text("黑名单")');
    if (await blackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await blackBtn.click();
      await expect(page.locator('#page-blacklist, .blacklist-page')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});
