/**
 * 冒烟测试：验证页面能正常打开
 */
const { test, expect } = require('@playwright/test');

test('首页加载成功', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/今天吃啥/i);
});
