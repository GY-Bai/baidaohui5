import { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // 基础健康检查
  fastify.get('/api/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  });

  // 详细健康检查
  fastify.get('/api/health/detailed', async (request, reply) => {
    const memoryUsage = process.memoryUsage();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      },
      cpu: process.cpuUsage(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    };
  });

  // 就绪检查
  fastify.get('/api/ready', async (request, reply) => {
    // 这里可以添加依赖服务的检查
    // 例如数据库连接、Redis连接等
    
    try {
      // 简单的就绪检查
      const isReady = true; // 可以根据实际情况检查依赖服务
      
      if (isReady) {
        return {
          status: 'ready',
          timestamp: new Date().toISOString()
        };
      } else {
        reply.status(503);
        return {
          status: 'not ready',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      reply.status(503);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // 存活检查
  fastify.get('/api/live', async (request, reply) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString()
    };
  });
};

export { healthRoutes }; 