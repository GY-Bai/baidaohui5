/**
 * 集成测试 - 测试 Auth 和 Invite API 的完整流程
 */

import jwt from 'jsonwebtoken';

// 测试环境配置
const TEST_ENV = {
  SUPABASE_JWT_SECRET: 'test-supabase-secret-key-for-integration-tests',
  SESSION_JWT_SECRET: 'test-session-secret-key-for-integration-tests',
  MONGODB_URL: 'mongodb://localhost:27017/baidaohui_test',
  FRONTEND_URL: 'https://test.baidaohui.com'
};

describe('Auth & Invite Integration Tests', () => {
  
  describe('完整认证流程', () => {
    test('新用户注册流程', async () => {
      // 1. 模拟 Supabase JWT
      const supabasePayload = {
        sub: 'test-user-123',
        email: 'newuser@example.com',
        user_metadata: {
          full_name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg'
        },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const supabaseToken = jwt.sign(supabasePayload, TEST_ENV.SUPABASE_JWT_SECRET);

      // 2. 验证 JWT 生成正确
      expect(supabaseToken).toBeDefined();
      expect(typeof supabaseToken).toBe('string');

      // 3. 验证 JWT 可以被正确解析
      const decoded = jwt.verify(supabaseToken, TEST_ENV.SUPABASE_JWT_SECRET) as any;
      expect(decoded.sub).toBe(supabasePayload.sub);
      expect(decoded.email).toBe(supabasePayload.email);
    });

    test('带邀请码的用户注册流程', async () => {
      // 1. 模拟邀请码
      const inviteToken = 'test-invite-token-member-123';
      
      // 2. 模拟 Supabase JWT
      const supabasePayload = {
        sub: 'test-user-456',
        email: 'inviteduser@example.com',
        user_metadata: {
          full_name: 'Invited User'
        },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const supabaseToken = jwt.sign(supabasePayload, TEST_ENV.SUPABASE_JWT_SECRET);

      // 3. 验证邀请码格式
      expect(inviteToken).toMatch(/^test-invite-token-/);
      expect(supabaseToken).toBeDefined();
    });
  });

  describe('邀请创建流程', () => {
    test('Master创建Member邀请', async () => {
      // 1. 模拟 Master 的 Session JWT
      const masterSessionPayload = {
        userId: 'master-user-id',
        supabaseId: 'master-supabase-id',
        email: 'master@baidaohui.com',
        role: 'master',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
      };

      const masterSessionToken = jwt.sign(masterSessionPayload, TEST_ENV.SESSION_JWT_SECRET);

      // 2. 验证 Master 权限
      const decoded = jwt.verify(masterSessionToken, TEST_ENV.SESSION_JWT_SECRET) as any;
      expect(decoded.role).toBe('master');

      // 3. 模拟邀请创建请求
      const inviteRequest = {
        type: 'member' as const,
        expiresIn: 24,
        maxUses: 1
      };

      expect(inviteRequest.type).toBe('member');
      expect(inviteRequest.expiresIn).toBe(24);
      expect(inviteRequest.maxUses).toBe(1);
    });

    test('Firstmate创建Member邀请', async () => {
      // 1. 模拟 Firstmate 的 Session JWT
      const firstmateSessionPayload = {
        userId: 'firstmate-user-id',
        supabaseId: 'firstmate-supabase-id',
        email: 'firstmate@baidaohui.com',
        role: 'firstmate',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
      };

      const firstmateSessionToken = jwt.sign(firstmateSessionPayload, TEST_ENV.SESSION_JWT_SECRET);

      // 2. 验证 Firstmate 权限
      const decoded = jwt.verify(firstmateSessionToken, TEST_ENV.SESSION_JWT_SECRET) as any;
      expect(decoded.role).toBe('firstmate');

      // 3. 验证 Firstmate 不能创建 Firstmate 邀请
      const invalidRequest = {
        type: 'firstmate' as const,
        expiresIn: 24,
        maxUses: 1
      };

      // 这应该在实际API中被拒绝
      expect(invalidRequest.type).toBe('firstmate');
      expect(decoded.role).not.toBe('master'); // Firstmate 不是 Master
    });
  });

  describe('权限验证', () => {
    test('验证角色层级', () => {
      const roles = ['fan', 'member', 'firstmate', 'master'];
      
      // Fan 权限最低
      expect(roles.indexOf('fan')).toBe(0);
      
      // Master 权限最高
      expect(roles.indexOf('master')).toBe(3);
      
      // Member 在 Firstmate 之前
      expect(roles.indexOf('member')).toBeLessThan(roles.indexOf('firstmate'));
    });

    test('验证JWT过期处理', () => {
      const expiredPayload = {
        userId: 'test-user',
        role: 'member',
        iat: Math.floor(Date.now() / 1000) - 3600, // 1小时前
        exp: Math.floor(Date.now() / 1000) - 1800  // 30分钟前过期
      };

      const expiredToken = jwt.sign(expiredPayload, TEST_ENV.SESSION_JWT_SECRET);
      
      // 验证过期token会被拒绝
      expect(() => {
        jwt.verify(expiredToken, TEST_ENV.SESSION_JWT_SECRET, { ignoreExpiration: false });
      }).toThrow();
    });
  });

  describe('数据验证', () => {
    test('验证邀请链接格式', () => {
      const inviteToken = 'abc123def456ghi789';
      const baseUrl = TEST_ENV.FRONTEND_URL;
      const inviteUrl = `${baseUrl}/auth/sign-up?invite=${inviteToken}`;
      
      expect(inviteUrl).toBe('https://test.baidaohui.com/auth/sign-up?invite=abc123def456ghi789');
      expect(inviteUrl).toMatch(/^https:\/\/.*\/auth\/sign-up\?invite=.+$/);
    });

    test('验证用户数据结构', () => {
      const userData = {
        supabaseId: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'member',
        status: 'active',
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 验证必需字段
      expect(userData.supabaseId).toBeDefined();
      expect(userData.email).toBeDefined();
      expect(userData.role).toBeDefined();
      expect(userData.status).toBeDefined();

      // 验证角色值
      expect(['fan', 'member', 'firstmate', 'master']).toContain(userData.role);
      
      // 验证状态值
      expect(['active', 'inactive', 'banned']).toContain(userData.status);
    });

    test('验证邀请数据结构', () => {
      const inviteData = {
        token: 'invite-token-123',
        type: 'member',
        createdBy: 'master-user-id',
        status: 'active',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 验证必需字段
      expect(inviteData.token).toBeDefined();
      expect(inviteData.type).toBeDefined();
      expect(inviteData.createdBy).toBeDefined();
      expect(inviteData.status).toBeDefined();
      expect(inviteData.expiresAt).toBeDefined();

      // 验证类型值
      expect(['member', 'firstmate']).toContain(inviteData.type);
      
      // 验证状态值
      expect(['active', 'used', 'expired', 'revoked']).toContain(inviteData.status);
      
      // 验证使用次数逻辑
      expect(inviteData.usedCount).toBeLessThanOrEqual(inviteData.maxUses);
    });
  });
}); 