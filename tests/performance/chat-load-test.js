import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const chatMessageRate = new Rate('chat_message_success_rate');
const paymentRate = new Rate('payment_success_rate');
const responseTime = new Trend('response_time');

// 测试配置
export const options = {
  scenarios: {
    // 聊天并发测试 - 100个并发用户
    chat_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      tags: { test_type: 'chat' },
      exec: 'chatTest',
    },
    // 支付并发测试 - 20个并发用户
    payment_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
      tags: { test_type: 'payment' },
      exec: 'paymentTest',
    },
    // 混合负载测试
    mixed_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 }, // 逐步增加到50个用户
        { duration: '5m', target: 50 }, // 保持50个用户5分钟
        { duration: '2m', target: 100 }, // 增加到100个用户
        { duration: '5m', target: 100 }, // 保持100个用户5分钟
        { duration: '2m', target: 0 }, // 逐步减少到0
      ],
      tags: { test_type: 'mixed' },
      exec: 'mixedTest',
    },
  },
  thresholds: {
    // 性能阈值要求
    http_req_duration: ['p(95)<400'], // 95%的请求响应时间小于400ms
    http_req_failed: ['rate<0.1'], // 失败率小于10%
    chat_message_success_rate: ['rate>0.95'], // 聊天消息成功率大于95%
    payment_success_rate: ['rate>0.98'], // 支付成功率大于98%
  },
};

// 测试数据
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3002';

// 模拟用户认证
function authenticate() {
  const loginPayload = {
    email: `test-user-${__VU}-${Math.random()}@example.com`,
    password: 'TestPassword123!',
  };

  const response = http.post(`${BASE_URL}/api/auth/sign-in`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'login successful': (r) => r.status === 200,
  });

  return response.json('token') || 'mock-token';
}

// 聊天负载测试
export function chatTest() {
  const token = authenticate();
  
  // WebSocket连接测试
  const wsUrl = `${WS_URL}/chat?token=${token}`;
  
  const response = ws.connect(wsUrl, {}, function (socket) {
    socket.on('open', () => {
      console.log(`VU ${__VU}: WebSocket connected`);
      
      // 发送消息测试
      for (let i = 0; i < 10; i++) {
        const message = {
          type: 'message',
          content: `Test message ${i} from VU ${__VU}`,
          channelId: 'general',
          timestamp: Date.now(),
        };
        
        const startTime = Date.now();
        socket.send(JSON.stringify(message));
        
        socket.on('message', (data) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          responseTime.add(duration);
          chatMessageRate.add(true);
          
          check(data, {
            'message received': (msg) => msg.length > 0,
            'response time < 400ms': () => duration < 400,
          });
        });
        
        sleep(1); // 每秒发送一条消息
      }
    });

    socket.on('error', (e) => {
      console.log(`VU ${__VU}: WebSocket error:`, e);
      chatMessageRate.add(false);
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000); // 30秒后关闭连接
  });

  check(response, {
    'websocket connection established': (r) => r && r.status === 101,
  });
}

// 支付负载测试
export function paymentTest() {
  const token = authenticate();
  
  // 创建算命订单
  const orderPayload = {
    amount: Math.floor(Math.random() * 100) + 10, // 10-110 USD
    message: `Performance test order from VU ${__VU}`,
    isUrgent: Math.random() > 0.8, // 20%概率为紧急
  };

  const startTime = Date.now();
  
  const orderResponse = http.post(
    `${BASE_URL}/api/fortune/order`,
    JSON.stringify(orderPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const orderDuration = Date.now() - startTime;
  responseTime.add(orderDuration);

  const orderSuccess = check(orderResponse, {
    'order created': (r) => r.status === 201,
    'order response time < 400ms': () => orderDuration < 400,
  });

  if (orderSuccess) {
    const orderId = orderResponse.json('id');
    
    // 模拟Stripe支付
    const paymentStartTime = Date.now();
    
    const paymentResponse = http.post(
      `${BASE_URL}/api/fortune/stripe/create-session`,
      JSON.stringify({ orderId }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const paymentDuration = Date.now() - paymentStartTime;
    responseTime.add(paymentDuration);

    const paymentSuccess = check(paymentResponse, {
      'payment session created': (r) => r.status === 200,
      'payment response time < 400ms': () => paymentDuration < 400,
    });

    paymentRate.add(paymentSuccess);
  } else {
    paymentRate.add(false);
  }

  sleep(2); // 支付间隔2秒
}

// 混合负载测试
export function mixedTest() {
  const testType = Math.random();
  
  if (testType < 0.7) {
    // 70%概率执行聊天测试
    chatTest();
  } else {
    // 30%概率执行支付测试
    paymentTest();
  }
}

// 测试生命周期钩子
export function setup() {
  console.log('🚀 Starting performance tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  
  // 健康检查
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'service is healthy': (r) => r.status === 200,
  });
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Performance tests completed in ${duration}s`);
  
  // 生成测试报告摘要
  console.log('📊 Test Summary:');
  console.log(`- Total duration: ${duration}s`);
  console.log(`- Chat scenarios: 100 concurrent users`);
  console.log(`- Payment scenarios: 20 concurrent users`);
  console.log(`- Target p95 response time: <400ms`);
} 