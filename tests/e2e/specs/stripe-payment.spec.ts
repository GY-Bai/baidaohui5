import { test, expect, Page } from '@playwright/test';

// 测试用的Stripe测试卡号
const TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  threeDSecure: '4000000000003220',
  insufficientFunds: '4000000000009995',
  expired: '4000000000000069',
};

// 测试用户信息
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123456',
  name: 'Test User',
};

// 辅助函数：填写信用卡信息
async function fillCardDetails(page: Page, cardNumber: string) {
  // 等待Stripe Elements加载
  await page.waitForSelector('iframe[name^="__privateStripeFrame"]');
  
  // 切换到卡号输入框iframe
  const cardNumberFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await cardNumberFrame.locator('[name="cardnumber"]').fill(cardNumber);
  
  // 填写过期日期
  const expiryFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').nth(1);
  await expiryFrame.locator('[name="exp-date"]').fill('12/25');
  
  // 填写CVC
  const cvcFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').nth(2);
  await cvcFrame.locator('[name="cvc"]').fill('123');
}

// 辅助函数：登录用户
async function loginUser(page: Page) {
  await page.goto('/auth/sign-in');
  await page.fill('[data-testid="email-input"]', TEST_USER.email);
  await page.fill('[data-testid="password-input"]', TEST_USER.password);
  await page.click('[data-testid="sign-in-button"]');
  await page.waitForURL('/home');
}

test.describe('Stripe支付测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置测试环境
    await page.addInitScript(() => {
      window.localStorage.setItem('test-mode', 'true');
    });
  });

  test('成功支付流程', async ({ page }) => {
    await loginUser(page);
    
    // 进入算命页面
    await page.goto('/fortune/new');
    
    // 选择算命类型
    await page.click('[data-testid="fortune-type-basic"]');
    
    // 填写问题
    await page.fill('[data-testid="fortune-question"]', '我的事业发展如何？');
    
    // 点击支付按钮
    await page.click('[data-testid="pay-button"]');
    
    // 等待Stripe Checkout页面加载
    await page.waitForURL(/checkout\.stripe\.com/);
    
    // 填写邮箱
    await page.fill('[data-testid="email"]', TEST_USER.email);
    
    // 填写信用卡信息
    await fillCardDetails(page, TEST_CARDS.success);
    
    // 填写账单地址
    await page.fill('[data-testid="billingName"]', TEST_USER.name);
    await page.selectOption('[data-testid="billingCountry"]', 'US');
    await page.fill('[data-testid="billingPostalCode"]', '12345');
    
    // 提交支付
    await page.click('[data-testid="submit"]');
    
    // 等待重定向到成功页面
    await page.waitForURL(/\/fortune\/success/);
    
    // 验证支付成功
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-id"]')).toBeVisible();
    
    // 验证订单状态
    const orderId = await page.locator('[data-testid="order-id"]').textContent();
    expect(orderId).toMatch(/^order_/);
  });

  test('支付取消流程', async ({ page }) => {
    await loginUser(page);
    
    // 进入商店页面
    await page.goto('/shop');
    
    // 选择商品
    await page.click('[data-testid="product-item"]').first();
    
    // 添加到购物车
    await page.click('[data-testid="add-to-cart"]');
    
    // 进入购物车
    await page.click('[data-testid="cart-button"]');
    
    // 点击结账
    await page.click('[data-testid="checkout-button"]');
    
    // 等待Stripe Checkout页面加载
    await page.waitForURL(/checkout\.stripe\.com/);
    
    // 点击返回按钮取消支付
    await page.click('[data-testid="back-button"]');
    
    // 验证返回到购物车页面
    await page.waitForURL(/\/cart/);
    await expect(page.locator('[data-testid="cart-items"]')).toBeVisible();
  });

  test('3D Secure验证流程', async ({ page }) => {
    await loginUser(page);
    
    // 进入算命页面
    await page.goto('/fortune/new');
    
    // 选择高级算命（需要3D Secure）
    await page.click('[data-testid="fortune-type-premium"]');
    
    // 填写问题
    await page.fill('[data-testid="fortune-question"]', '我的感情运势如何？');
    
    // 点击支付按钮
    await page.click('[data-testid="pay-button"]');
    
    // 等待Stripe Checkout页面加载
    await page.waitForURL(/checkout\.stripe\.com/);
    
    // 填写邮箱
    await page.fill('[data-testid="email"]', TEST_USER.email);
    
    // 填写需要3D Secure的卡号
    await fillCardDetails(page, TEST_CARDS.threeDSecure);
    
    // 填写账单地址
    await page.fill('[data-testid="billingName"]', TEST_USER.name);
    await page.selectOption('[data-testid="billingCountry"]', 'US');
    await page.fill('[data-testid="billingPostalCode"]', '12345');
    
    // 提交支付
    await page.click('[data-testid="submit"]');
    
    // 等待3D Secure弹窗
    await page.waitForSelector('[data-testid="stripe-challenge-frame"]');
    
    // 在3D Secure弹窗中点击"Complete authentication"
    const challengeFrame = page.frameLocator('[data-testid="stripe-challenge-frame"]');
    await challengeFrame.locator('[data-testid="complete-auth"]').click();
    
    // 等待重定向到成功页面
    await page.waitForURL(/\/fortune\/success/);
    
    // 验证支付成功
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
  });

  test('支付失败处理', async ({ page }) => {
    await loginUser(page);
    
    // 进入商店页面
    await page.goto('/shop');
    
    // 选择商品
    await page.click('[data-testid="product-item"]').first();
    
    // 添加到购物车
    await page.click('[data-testid="add-to-cart"]');
    
    // 进入购物车
    await page.click('[data-testid="cart-button"]');
    
    // 点击结账
    await page.click('[data-testid="checkout-button"]');
    
    // 等待Stripe Checkout页面加载
    await page.waitForURL(/checkout\.stripe\.com/);
    
    // 填写邮箱
    await page.fill('[data-testid="email"]', TEST_USER.email);
    
    // 填写会被拒绝的卡号
    await fillCardDetails(page, TEST_CARDS.decline);
    
    // 填写账单地址
    await page.fill('[data-testid="billingName"]', TEST_USER.name);
    await page.selectOption('[data-testid="billingCountry"]', 'US');
    await page.fill('[data-testid="billingPostalCode"]', '12345');
    
    // 提交支付
    await page.click('[data-testid="submit"]');
    
    // 等待错误消息
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Your card was declined');
  });

  test('余额不足处理', async ({ page }) => {
    await loginUser(page);
    
    // 进入算命页面
    await page.goto('/fortune/new');
    
    // 选择算命类型
    await page.click('[data-testid="fortune-type-basic"]');
    
    // 填写问题
    await page.fill('[data-testid="fortune-question"]', '我的财运如何？');
    
    // 点击支付按钮
    await page.click('[data-testid="pay-button"]');
    
    // 等待Stripe Checkout页面加载
    await page.waitForURL(/checkout\.stripe\.com/);
    
    // 填写邮箱
    await page.fill('[data-testid="email"]', TEST_USER.email);
    
    // 填写余额不足的卡号
    await fillCardDetails(page, TEST_CARDS.insufficientFunds);
    
    // 填写账单地址
    await page.fill('[data-testid="billingName"]', TEST_USER.name);
    await page.selectOption('[data-testid="billingCountry"]', 'US');
    await page.fill('[data-testid="billingPostalCode"]', '12345');
    
    // 提交支付
    await page.click('[data-testid="submit"]');
    
    // 等待错误消息
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('insufficient funds');
  });

  test('过期卡处理', async ({ page }) => {
    await loginUser(page);
    
    // 进入商店页面
    await page.goto('/shop');
    
    // 选择商品
    await page.click('[data-testid="product-item"]').first();
    
    // 添加到购物车
    await page.click('[data-testid="add-to-cart"]');
    
    // 进入购物车
    await page.click('[data-testid="cart-button"]');
    
    // 点击结账
    await page.click('[data-testid="checkout-button"]');
    
    // 等待Stripe Checkout页面加载
    await page.waitForURL(/checkout\.stripe\.com/);
    
    // 填写邮箱
    await page.fill('[data-testid="email"]', TEST_USER.email);
    
    // 填写过期的卡号
    await fillCardDetails(page, TEST_CARDS.expired);
    
    // 填写账单地址
    await page.fill('[data-testid="billingName"]', TEST_USER.name);
    await page.selectOption('[data-testid="billingCountry"]', 'US');
    await page.fill('[data-testid="billingPostalCode"]', '12345');
    
    // 提交支付
    await page.click('[data-testid="submit"]');
    
    // 等待错误消息
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('expired');
  });
});

test.describe('Stripe Webhook测试', () => {
  test('Webhook签名验证', async ({ request }) => {
    // 模拟Stripe webhook事件
    const webhookPayload = {
      id: 'evt_test_webhook',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_payment_intent',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
        },
      },
    };

    // 生成测试签名
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify(webhookPayload);
    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
    
    // 创建签名
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    
    const stripeSignature = `t=${timestamp},v1=${signature}`;

    // 发送webhook请求
    const response = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignature,
      },
    });

    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    expect(responseBody.received).toBe(true);
  });

  test('Webhook事件去重', async ({ request }) => {
    const webhookPayload = {
      id: 'evt_duplicate_test',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_duplicate_test',
          amount: 1000,
          currency: 'usd',
          status: 'succeeded',
        },
      },
    };

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify(webhookPayload);
    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
    
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    
    const stripeSignature = `t=${timestamp},v1=${signature}`;

    // 第一次发送webhook
    const firstResponse = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignature,
      },
    });

    expect(firstResponse.status()).toBe(200);

    // 第二次发送相同的webhook（应该被去重）
    const secondResponse = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignature,
      },
    });

    expect(secondResponse.status()).toBe(200);
    
    const responseBody = await secondResponse.json();
    expect(responseBody.message).toContain('already processed');
  });

  test('无效签名拒绝', async ({ request }) => {
    const webhookPayload = {
      id: 'evt_invalid_signature',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_invalid_signature',
          amount: 1500,
          currency: 'usd',
          status: 'succeeded',
        },
      },
    };

    const payload = JSON.stringify(webhookPayload);
    const invalidSignature = 't=1234567890,v1=invalid_signature_hash';

    // 发送带有无效签名的webhook
    const response = await request.post('/api/stripe/webhook', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': invalidSignature,
      },
    });

    expect(response.status()).toBe(400);
    
    const responseBody = await response.json();
    expect(responseBody.error).toContain('Invalid signature');
  });
}); 