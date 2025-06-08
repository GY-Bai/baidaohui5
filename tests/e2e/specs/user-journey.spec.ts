import { test, expect } from '@playwright/test';

// 测试数据
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

const MASTER_USER = {
  email: 'master@baidaohui.com',
  password: 'MasterPassword123!',
};

test.describe('百刀会完整用户旅程测试', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前清理状态
    await page.context().clearCookies();
    await page.goto('/');
  });

  test('1. 用户注册和角色路由', async ({ page }) => {
    // 访问首页，应该重定向到登录页
    await page.goto('/');
    await expect(page).toHaveURL(/.*auth\/sign-in/);

    // 点击注册链接
    await page.click('text=注册');
    await expect(page).toHaveURL(/.*auth\/sign-up/);

    // 填写注册表单
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // 等待注册成功，应该重定向到验证页面
    await expect(page).toHaveURL(/.*auth\/verify/);
    
    // 截图保存
    await page.screenshot({ path: 'test-results/01-registration.png' });
  });

  test('2. 邀请链接生成和使用', async ({ page }) => {
    // 以Master身份登录
    await loginAsMaster(page);

    // 进入管理后台
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('管理后台');

    // 进入邀请管理页面
    await page.click('text=邀请管理');
    await expect(page).toHaveURL(/.*admin\/invite/);

    // 生成Member邀请链接
    await page.selectOption('select[name="role"]', 'member');
    await page.selectOption('select[name="duration"]', '24h');
    await page.selectOption('select[name="maxUses"]', '10');
    await page.click('button:has-text("生成邀请链接")');

    // 验证邀请链接生成
    const inviteLink = await page.locator('[data-testid="invite-link"]').textContent();
    expect(inviteLink).toContain('invite');

    // 验证二维码生成
    await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();

    // 测试复制链接功能
    await page.click('button:has-text("复制链接")');
    
    // 截图保存
    await page.screenshot({ path: 'test-results/02-invite-generation.png' });

    // 在新标签页中使用邀请链接
    const newPage = await page.context().newPage();
    await newPage.goto(inviteLink!);
    await expect(newPage).toHaveURL(/.*auth\/sign-up/);
    await newPage.close();
  });

  test('3. 算命订单流程', async ({ page }) => {
    // 以普通用户身份登录
    await loginAsUser(page);

    // 进入算命申请页面
    await page.goto('/fortune/new');
    await expect(page.locator('h1')).toContainText('新算命申请');

    // 填写申请表单
    await page.fill('input[name="amount"]', '50');
    await page.fill('textarea[name="message"]', '请帮我看看今年的运势如何，特别是事业方面的发展。');
    
    // 勾选紧急选项
    await page.check('input[name="isUrgent"]');

    // 上传图片（模拟）
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-files/sample-image.jpg');

    // 验证实时排名显示
    await expect(page.locator('[data-testid="current-rank"]')).toBeVisible();

    // 提交申请
    await page.click('button[type="submit"]');

    // 验证跳转到支付页面
    await expect(page).toHaveURL(/.*stripe/);
    
    // 截图保存
    await page.screenshot({ path: 'test-results/03-fortune-order.png' });
  });

  test('4. 聊天功能测试', async ({ page }) => {
    // 以Member身份登录
    await loginAsMember(page);

    // 进入聊天页面
    await page.goto('/home');
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // 测试发送文本消息
    const messageInput = page.locator('[data-testid="message-input"]');
    await messageInput.fill('Hello, this is a test message');
    await page.keyboard.press('Enter');

    // 验证消息发送成功
    await expect(page.locator('text=Hello, this is a test message')).toBeVisible();

    // 测试图片上传
    const imageUpload = page.locator('input[type="file"]');
    await imageUpload.setInputFiles('test-files/chat-image.jpg');

    // 验证图片消息显示
    await expect(page.locator('[data-testid="image-message"]')).toBeVisible();

    // 测试表情符号
    await page.click('[data-testid="emoji-button"]');
    await page.click('[data-testid="emoji-😀"]');
    await expect(page.locator('text=😀')).toBeVisible();

    // 测试"正在输入"提示
    await messageInput.fill('正在输入测试...');
    await expect(page.locator('text=正在输入')).toBeVisible();

    // 截图保存
    await page.screenshot({ path: 'test-results/04-chat-functionality.png' });
  });

  test('5. 电商购买流程', async ({ page }) => {
    // 访问商店页面
    await page.goto('/shop');
    await expect(page.locator('h1')).toContainText('商店');

    // 验证商品瀑布流加载
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

    // 选择第一个商品
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await firstProduct.click();

    // 验证商品详情页
    await expect(page.locator('[data-testid="product-details"]')).toBeVisible();

    // 点击购买按钮
    await page.click('button:has-text("立即购买")');

    // 验证跳转到Stripe支付页面
    await expect(page).toHaveURL(/.*stripe/);
    
    // 截图保存
    await page.screenshot({ path: 'test-results/05-ecommerce-purchase.png' });
  });

  test('6. 管理员操作测试', async ({ page }) => {
    // 以Master身份登录
    await loginAsMaster(page);

    // 测试算命订单管理
    await page.goto('/admin/orders');
    await expect(page.locator('h1')).toContainText('算命订单管理');

    // 查看订单详情
    const firstOrder = page.locator('[data-testid="order-row"]').first();
    await firstOrder.click();

    // 填写回复
    await page.fill('textarea[name="reply"]', '根据您的生辰八字，今年运势整体向好...');
    await page.click('button:has-text("发送回复")');

    // 验证回复成功
    await expect(page.locator('text=回复已发送')).toBeVisible();

    // 测试聊天权限管理
    await page.goto('/admin/chat-perms');
    await expect(page.locator('h1')).toContainText('聊天权限管理');

    // 切换用户权限
    const firstUserToggle = page.locator('[data-testid="permission-toggle"]').first();
    await firstUserToggle.click();

    // 验证权限更新
    await expect(page.locator('text=权限已更新')).toBeVisible();

    // 测试商户密钥管理
    await page.goto('/admin/sellers');
    await expect(page.locator('h1')).toContainText('商户管理');

    // 添加新密钥
    await page.click('button:has-text("添加密钥")');
    await page.fill('input[name="keyName"]', 'Test Seller Key');
    await page.fill('input[name="stripeKey"]', 'sk_test_123456789');
    await page.click('button:has-text("保存")');

    // 验证密钥添加成功
    await expect(page.locator('text=Test Seller Key')).toBeVisible();
    
    // 截图保存
    await page.screenshot({ path: 'test-results/06-admin-operations.png' });
  });

  test('7. 移动端响应式测试', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });

    // 测试移动端导航
    await page.goto('/');
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // 测试移动端聊天界面
    await page.goto('/home');
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    // 验证移动端输入框
    const mobileInput = page.locator('[data-testid="mobile-message-input"]');
    await expect(mobileInput).toBeVisible();

    // 测试移动端商店页面
    await page.goto('/shop');
    await expect(page.locator('[data-testid="mobile-product-grid"]')).toBeVisible();
    
    // 截图保存
    await page.screenshot({ path: 'test-results/07-mobile-responsive.png' });
  });

  test('8. 性能和可访问性测试', async ({ page }) => {
    // 测试页面加载性能
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    // 验证页面加载时间小于3秒
    expect(loadTime).toBeLessThan(3000);

    // 测试可访问性 - 检查aria-label
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();
      
      // 每个按钮应该有aria-label或文本内容
      expect(ariaLabel || textContent).toBeTruthy();
    }

    // 测试键盘导航
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // 截图保存
    await page.screenshot({ path: 'test-results/08-accessibility.png' });
  });
});

// 辅助函数
async function loginAsMaster(page: any) {
  await page.goto('/auth/sign-in');
  await page.fill('input[type="email"]', MASTER_USER.email);
  await page.fill('input[type="password"]', MASTER_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/master');
}

async function loginAsUser(page: any) {
  await page.goto('/auth/sign-in');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/fan');
}

async function loginAsMember(page: any) {
  await page.goto('/auth/sign-in');
  await page.fill('input[type="email"]', 'member@example.com');
  await page.fill('input[type="password"]', 'MemberPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/member');
} 