/**
 * 决策流程 E2E 测试（转盘 + 扫雷）
 * Stories: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.2, 3.3, 3.4
 */
const { test, expect } = require('@playwright/test');

// 确保有足够餐厅用于决策（名称带时间戳避免重复）
async function ensureRestaurants(request, count = 3) {
  for (let i = 0; i < count; i++) {
    await request.post('/api/restaurants', {
      headers: { 'X-User-Id': '1', 'Content-Type': 'application/json' },
      data: { name: `决策测试餐厅${i}_${Date.now()}_${Math.random()}`, tags: [] },
    }).catch(() => {});
  }
}

// 等待「开始决策」按钮变为可点击（页面初始化后才 enabled）
async function waitForDecisionBtn(page) {
  await expect(page.locator('#btn-start-decision')).toBeEnabled({ timeout: 10000 });
}

// 通用：从首页进入模式选择页
async function navigateToDecidePage(page) {
  await waitForDecisionBtn(page);
  await page.locator('#btn-start-decision').click();
  await expect(page.locator('#page-decide')).toBeVisible({ timeout: 5000 });
}

// 通用：从模式选择页进入转盘页
// 当候选数 > 16 时经过勾选页，否则直接到转盘页
async function navigateToWheelPage(page) {
  await page.locator('#btn-choose-wheel').click();

  // 等待转盘页或勾选页之一出现
  const wheelOrSelect = page.locator('#page-wheel, #page-wheel-select');
  await expect(wheelOrSelect.first()).toBeVisible({ timeout: 8000 });

  // 如果进了勾选页，确认后进入转盘页
  const selectVisible = await page.locator('#page-wheel-select').isVisible().catch(() => false);
  if (selectVisible) {
    await page.locator('#btn-wheel-select-confirm').click();
    await expect(page.locator('#page-wheel')).toBeVisible({ timeout: 5000 });
  }
  // 否则已经在转盘页，不需额外操作
}

test.describe('模式选择页', () => {
  test('首页有「开始决策」按钮', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#btn-start-decision');
    await expect(btn).toBeVisible({ timeout: 8000 });
  });

  test('点击「开始决策」跳转到模式选择页', async ({ page, request }) => {
    await ensureRestaurants(request);
    await page.goto('/');
    await navigateToDecidePage(page);
  });

  test('模式选择页有转盘和扫雷两张卡', async ({ page, request }) => {
    await ensureRestaurants(request);
    await page.goto('/');
    await navigateToDecidePage(page);

    await expect(page.locator('#btn-choose-wheel')).toBeVisible();
    await expect(page.locator('#btn-choose-mine')).toBeVisible();
  });
});

test.describe('转盘决策流程', () => {
  test('点击转盘模式进入转盘相关页面', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);

    await page.locator('#btn-choose-wheel').click();
    // 进入勾选页（>16 个餐厅时）或直接进入转盘页
    const wheelOrSelect = page.locator('#page-wheel, #page-wheel-select');
    await expect(wheelOrSelect.first()).toBeVisible({ timeout: 8000 });
  });

  test('转盘页包含 Canvas 元素', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);
    await navigateToWheelPage(page);

    await expect(page.locator('#wheel-canvas')).toBeVisible({ timeout: 5000 });
  });

  test('点击「开始旋转」按钮触发旋转', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);
    await navigateToWheelPage(page);

    await page.locator('#btn-wheel-spin').click();

    // 旋转后按钮变为禁用（旋转中）
    await expect(page.locator('#btn-wheel-spin')).toBeDisabled({ timeout: 5000 });
  });

  test('转盘旋转后显示结果页', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);
    await navigateToWheelPage(page);

    await page.locator('#btn-wheel-spin').click();

    // 等待结果页（旋转 2-4 秒 + 600ms 延迟）
    await expect(page.locator('#page-result')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#result-name')).not.toBeEmpty();
  });
});

test.describe('转盘勾选页（需 >16 个候选）', () => {
  test('候选数超过 limit 时显示勾选页', async ({ page, request }) => {
    // 创建 20 个餐厅以确保触发 sampledDown
    await ensureRestaurants(request, 20);
    await page.goto('/');
    await navigateToDecidePage(page);

    await page.locator('#btn-choose-wheel').click();
    await expect(page.locator('#page-wheel-select')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('扫雷决策流程', () => {
  test('扫雷模式可进入', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);

    await page.locator('#btn-choose-mine').click();
    await expect(page.locator('#page-mine')).toBeVisible({ timeout: 8000 });
  });

  test('扫雷页有格子', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);
    await page.locator('#btn-choose-mine').click();

    await expect(page.locator('#page-mine')).toBeVisible({ timeout: 8000 });
    // 等待格子渲染
    await page.waitForTimeout(1000);
    const cells = await page.locator('.mine-cell').count();
    expect(cells).toBeGreaterThan(0);
  });

  test('点击格子触发翻牌', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);
    await page.locator('#btn-choose-mine').click();

    await expect(page.locator('#page-mine')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1000); // 等待格子渲染

    const firstCell = page.locator('.mine-cell').first();
    if (await firstCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCell.click();
      // 翻牌后可能进入结果页（若点到餐厅格）或格子变化
      await page.waitForTimeout(1000);
      const resultVisible = await page.locator('#page-result').isVisible().catch(() => false);
      const cellFlipped = await firstCell.evaluate(el =>
        el.classList.contains('revealed') || el.classList.contains('flipped')
      ).catch(() => false);
      expect(resultVisible || cellFlipped).toBe(true);
    } else {
      test.skip();
    }
  });
});

test.describe('结果页功能', () => {
  test('结果页有「就这家了」和「换一个」按钮', async ({ page, request }) => {
    await ensureRestaurants(request, 3);
    await page.goto('/');
    await navigateToDecidePage(page);
    await navigateToWheelPage(page);

    await page.locator('#btn-wheel-spin').click();
    await expect(page.locator('#page-result')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('#btn-result-confirm')).toBeVisible();
    await expect(page.locator('#btn-result-replay')).toBeVisible();
  });
});
