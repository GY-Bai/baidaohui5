import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';

interface SessionPayload {
  userId: string;
  supabaseId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Redis客户端（可选，用于缓存）
  let redisClient: ReturnType<typeof createClient> | null = null;
  
  if (process.env.REDIS_URL) {
    redisClient = createClient({
      url: process.env.REDIS_URL
    });
    
    redisClient.on('error', (err) => {
      fastify.log.error('Redis Client Error', err);
    });
    
    await redisClient.connect();
    fastify.log.info('Connected to Redis');
  }

  // 认证装饰器
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Missing or invalid authorization header',
          code: 'UNAUTHORIZED'
        });
      }

      const token = authHeader.substring(7);
      const sessionJwtSecret = process.env.SESSION_JWT_SECRET;
      
      if (!sessionJwtSecret) {
        fastify.log.error('SESSION_JWT_SECRET not configured');
        return reply.status(500).send({
          error: 'Server configuration error',
          code: 'INTERNAL_ERROR'
        });
      }

      // 检查Redis缓存（如果可用）
      if (redisClient) {
        const cacheKey = `session:${token}`;
        const cachedUser = await redisClient.get(cacheKey);
        
        if (cachedUser) {
          request.user = JSON.parse(cachedUser);
          return;
        }
      }

      // 验证JWT
      let payload: SessionPayload;
      try {
        payload = jwt.verify(token, sessionJwtSecret) as SessionPayload;
      } catch (error) {
        return reply.status(401).send({
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      }

      // 检查token是否过期
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return reply.status(401).send({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      // 设置用户信息
      request.user = payload;

      // 缓存到Redis（如果可用）
      if (redisClient) {
        const cacheKey = `session:${token}`;
        const ttl = payload.exp - now;
        
        if (ttl > 0) {
          await redisClient.setEx(cacheKey, ttl, JSON.stringify(payload));
        }
      }

    } catch (error) {
      fastify.log.error('Authentication error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // 角色检查辅助函数
  fastify.decorate('requireRole', (roles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticate(request, reply);
      
      if (!request.user || !roles.includes(request.user.role)) {
        return reply.status(403).send({
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          requiredRoles: roles,
          userRole: request.user?.role
        });
      }
    };
  });

  // 优雅关闭时断开Redis连接
  fastify.addHook('onClose', async () => {
    if (redisClient) {
      await redisClient.quit();
      fastify.log.info('Disconnected from Redis');
    }
  });
};

export { authPlugin }; 