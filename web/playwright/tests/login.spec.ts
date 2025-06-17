import { test, expect } from '@playwright/test';

test('登陆', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '用户名' }).click();
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '用户名' }).press('Tab');
  await page.getByRole('textbox', { name: '密码' }).fill('demo123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.locator('body')).toContainText('用户列表');
  await expect(page.getByText('FunCode 后台管理')).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
});