#!/usr/bin/env node

/**
 * AI服务回退机制测试脚本
 * 用于验证当主要AI服务不可用时，是否能正确回退到算力云服务
 */

const fetch = require('node-fetch');

// 测试配置
const TEST_CONFIG = {
  baseUrl: process.env.AI_PROXY_URL || 'http://localhost:3003',
  testMessage: {
    messages: [
      { role: 'user', content: '你好，请简单介绍一下自己' }
    ],
    model: 'gpt-4o', // 故意使用可能不可用的模型来触发回退
    max_tokens: 100
  }
};

async function testAIFallback() {
  console.log('🧪 开始测试AI服务回退机制...\n');

  try {
    console.log('📡 发送测试请求到AI代理服务...');
    console.log(`URL: ${TEST_CONFIG.baseUrl}/api/ai/chat`);
    
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(TEST_CONFIG.testMessage)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ AI服务响应成功!');
      console.log('📝 响应内容:', result.data.choices[0].message.content);
      
      if (result.data.model && result.data.model.includes('QwQ')) {
        console.log('🔄 检测到使用了算力云回退服务');
      } else {
        console.log('🎯 使用了主要AI服务');
      }
    } else {
      console.log('❌ AI服务请求失败:', result.error || response.statusText);
    }

  } catch (error) {
    console.error('💥 测试过程中发生错误:', error.message);
  }

  console.log('\n🏁 测试完成');
}

async function testHealthCheck() {
  console.log('\n🔍 检查AI服务健康状态...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/ai/health`);
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ 健康检查成功');
      console.log('📊 服务状态:', result.data.status);
      console.log('🔧 提供商状态:');
      
      Object.entries(result.data.providers).forEach(([provider, status]) => {
        const icon = status ? '✅' : '❌';
        console.log(`   ${icon} ${provider}: ${status ? '可用' : '不可用'}`);
      });
    } else {
      console.log('❌ 健康检查失败:', result.error || response.statusText);
    }
  } catch (error) {
    console.error('💥 健康检查过程中发生错误:', error.message);
  }
}

async function main() {
  console.log('🚀 AI服务回退机制测试工具');
  console.log('='.repeat(50));
  
  // 检查环境变量
  console.log('🔧 环境配置检查:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '已配置' : '未配置'}`);
  console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '已配置' : '未配置'}`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '已配置' : '未配置'}`);
  console.log(`   SUANLI_API_KEY: ${process.env.SUANLI_API_KEY ? '已配置' : '未配置'}`);
  
  await testHealthCheck();
  await testAIFallback();
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testAIFallback, testHealthCheck }; 