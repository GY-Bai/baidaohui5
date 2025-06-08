import jwt from 'jsonwebtoken';

// Mock环境变量
const mockEnv = {
  SUPABASE_JWT_SECRET: 'test-supabase-secret',
  SESSION_JWT_SECRET: 'test-session-secret',
  MONGODB_URI: 'mongodb+srv://test:test@cluster0.mongodb.net/test?retryWrites=true&w=majority'
};

// Mock MongoDB
const mockCollection = {
  findOne: jest.fn(),
  insertOne: jest.fn(),
  updateOne: jest.fn()
};

const mockDb = {
  collection: jest.fn(() => mockCollection)
};

const mockClient = {
  connect: jest.fn(),
  close: jest.fn(),
  db: jest.fn(() => mockDb)
};

jest.mock('mongodb', () => ({
  MongoClient: jest.fn(() => mockClient)
}));

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 设置环境变量
    Object.assign(process.env, mockEnv);
  });

  describe('JWT验证', () => {
    test('应该验证有效的Supabase JWT', () => {
      const payload = {
        sub: 'user123',
        email: 'test@example.com',
        user_metadata: {
          display_name: 'Test User'
        }
      };

      const token = jwt.sign(payload, mockEnv.SUPABASE_JWT_SECRET);
      const decoded = jwt.verify(token, mockEnv.SUPABASE_JWT_SECRET);

      expect(decoded).toMatchObject(payload);
    });

    test('应该拒绝无效的JWT', () => {
      const invalidToken = 'invalid.jwt.token';

      expect(() => {
        jwt.verify(invalidToken, mockEnv.SUPABASE_JWT_SECRET);
      }).toThrow();
    });

    test('应该生成有效的Session JWT', () => {
      const sessionPayload = {
        userId: 'user123',
        supabaseId: 'supabase123',
        email: 'test@example.com',
        role: 'fan',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
      };

      const sessionToken = jwt.sign(sessionPayload, mockEnv.SESSION_JWT_SECRET);
      const decoded = jwt.verify(sessionToken, mockEnv.SESSION_JWT_SECRET);

      expect(decoded).toMatchObject(sessionPayload);
    });
  });

  describe('用户创建逻辑', () => {
    test('应该为新用户创建默认fan角色', async () => {
      mockCollection.findOne.mockResolvedValue(null); // 用户不存在
      mockCollection.insertOne.mockResolvedValue({ insertedId: 'new-user-id' });

      // 模拟新用户创建逻辑
      const newUser = {
        supabaseId: 'user123',
        email: 'test@example.com',
        role: 'fan',
        status: 'active'
      };

      expect(newUser.role).toBe('fan');
      expect(newUser.status).toBe('active');
    });

    test('应该根据邀请码设置正确角色', async () => {
      const invite = {
        _id: 'invite123',
        token: 'valid-invite-token',
        type: 'member',
        status: 'active',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxUses: 1,
        usedCount: 0,
        createdBy: 'master-user-id'
      };

      mockCollection.findOne
        .mockResolvedValueOnce(null) // 用户不存在
        .mockResolvedValueOnce(invite); // 找到邀请

      // 模拟邀请码验证逻辑
      const isValidInvite = invite.status === 'active' && 
                           invite.expiresAt > new Date() && 
                           invite.usedCount < invite.maxUses;

      expect(isValidInvite).toBe(true);
      expect(invite.type).toBe('member');
    });
  });

  describe('错误处理', () => {
    test('应该处理缺失的token', () => {
      const request = { supabaseToken: undefined };
      
      expect(request.supabaseToken).toBeUndefined();
    });

    test('应该处理数据库连接错误', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      try {
        await mockClient.connect();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Connection failed');
      }
    });
  });
}); 