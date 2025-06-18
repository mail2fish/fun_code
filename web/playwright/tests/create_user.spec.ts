import { test, expect } from '@playwright/test';
import { login } from './login.spec';


// 创建一个测试组，包含需要登录的测试
test.describe('需要登录的管理功能', () => {
  // 每个测试之前都自动登录
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('循环创建26个学生', async ({ page }) => {
    // 不需要再手动登录，beforeEach已经处理了
    
    // 循环创建26个学生 (a-z)
    const timestamp = process.hrtime.bigint(); // 获取纳秒级时间戳
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
      await expect(page.getByLabel('用户创建成功！')).toContainText('继续创建用户');
      await expect(page.getByLabel('用户创建成功！')).toContainText('转到用户列表');
      await expect(page.getByRole('dialog', { name: '用户创建成功！' })).toBeVisible();
      await page.getByRole('button', { name: '继续创建用户' }).click();


      
      console.log(`成功创建学生: ${username}`);
    }
  });
});

