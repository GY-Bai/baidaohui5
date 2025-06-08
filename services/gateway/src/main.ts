import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import httpProxy from '@fastify/http-proxy';
import { authPlugin } from './plugins/auth';
import { healthRoutes } from './routes/health';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    } : undefined
  }
});

async function start() {
  try {
    // 注册插件
    await fastify.register(cors, {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true
    });

    await fastify.register(helmet, {
      contentSecurityPolicy: false
    });

    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });

    // 注册认证插件
    await fastify.register(authPlugin);

    // 注册健康检查路由
    await fastify.register(healthRoutes);

    // 代理路由配置
    const services = {
      '/api/fortune': {
        upstream: process.env.FORTUNE_SERVICE_URL || 'http://localhost:3001',
        prefix: '/api/fortune'
      },
      '/api/products': {
        upstream: process.env.SHOP_SERVICE_URL || 'http://localhost:3002',
        prefix: '/api/products'
      },
      '/api/chat': {
        upstream: process.env.CHAT_SERVICE_URL || 'http://localhost:3002',
        prefix: '/api/chat'
      },
      '/api/key': {
        upstream: process.env.KEY_SERVICE_URL || 'http://localhost:3004',
        prefix: '/api/key'
      },
      '/api/ai': {
        upstream: process.env.AI_PROXY_SERVICE_URL || 'http://localhost:3003',
        prefix: '/api/ai'
      }
    };

    // 注册代理路由
    for (const [prefix, config] of Object.entries(services)) {
      await fastify.register(httpProxy, {
        upstream: config.upstream,
        prefix,
        rewritePrefix: config.prefix,
        preHandler: fastify.authenticate, // 需要认证
        http2: false
      });
    }

    // Webhook路由不需要认证
    await fastify.register(httpProxy, {
      upstream: process.env.FORTUNE_SERVICE_URL || 'http://localhost:3001',
      prefix: '/api/webhook',
      rewritePrefix: '/api/webhook',
      http2: false
    });

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Gateway server listening on ${host}:${port}`);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  fastify.log.info('Received SIGINT, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  fastify.log.info('Received SIGTERM, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

start(); 