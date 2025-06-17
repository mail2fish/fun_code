import { test, expect } from '@playwright/test';

// 登录辅助函数
async function login(page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: '用户名' }).click();
  await page.getByRole('textbox', { name: '用户名' }).fill('admin');
  await page.getByRole('textbox', { name: '用户名' }).press('Tab');
  await page.getByRole('textbox', { name: '密码' }).fill('demo123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.locator('body')).toContainText('用户列表');
  await expect(page.getByText('FunCode 后台管理')).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
}

// 创建一个测试组，包含需要登录的测试
test.describe('需要登录的管理功能', () => {
  // 每个测试之前都自动登录
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('循环创建26个学生', async ({ page }) => {
    // 不需要再手动登录，beforeEach已经处理了
    
    // 循环创建26个学生 (a-z)
    const timestamp = Date.now(); // 获取当前时间戳
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(97 + i); // 'a' to 'z'
      const username = `student${letter}_${timestamp}`;
      const nickname = `学生${letter}_${timestamp}`;
      const email = `${username}@test.com`;
      const password = `${username}123`;

      await page.getByRole('listitem').filter({ hasText: '创建用户' }).getByRole('link').click();
      await page.getByRole('textbox', { name: '用户名' }).click();
      await page.getByRole('textbox', { name: '用户名' }).fill(username);
      await page.getByRole('textbox', { name: '用户名' }).press('Tab');
      await page.getByRole('textbox', { name: '昵称' }).fill(nickname);
      await page.getByRole('textbox', { name: '昵称' }).press('Tab');
      await page.getByRole('textbox', { name: '邮箱' }).fill(email);
      await page.getByRole('textbox', { name: '邮箱' }).press('Tab');
      await page.getByRole('textbox', { name: '密码' }).fill(password);
      await page.getByRole('button', { name: '创建用户' }).click();
      
      // 验证创建成功
      await expect(page.locator('tbody')).toContainText(username);
      await expect(page.locator('tbody')).toContainText(nickname);
      await expect(page.locator('tbody')).toContainText(email);
      await expect(page.locator('tbody')).toContainText('student');
      
      console.log(`成功创建学生: ${username}`);
    }
  });
});

// 单独的登录测试（不在测试组内）
test('登陆', async ({ page }) => {
  await login(page);
});