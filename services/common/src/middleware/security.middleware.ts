import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private helmetMiddleware = helmet({
    // 内容安全策略
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "https:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:"],
      },
    },
    // 跨域嵌入保护
    crossOriginEmbedderPolicy: false,
    // 跨域资源策略
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // DNS预取控制
    dnsPrefetchControl: { allow: false },
    // 强制HTTPS
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // 隐藏X-Powered-By
    hidePoweredBy: true,
    // IE兼容性
    ieNoOpen: true,
    // MIME类型嗅探保护
    noSniff: true,
    // 来源策略
    originAgentCluster: true,
    // 权限策略
    permittedCrossDomainPolicies: false,
    // 引用策略
    referrerPolicy: { policy: "no-referrer" },
    // XSS保护
    xssFilter: true,
  });

  // 速率限制
  private rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP最多100个请求
    message: {
      error: 'Too many requests',
      message: '请求过于频繁，请稍后再试',
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
    // 跳过成功的请求
    skipSuccessfulRequests: true,
    // 自定义键生成器
    keyGenerator: (req: Request) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
  });

  use(req: Request, res: Response, next: NextFunction) {
    // 应用Helmet安全头
    this.helmetMiddleware(req, res, (err) => {
      if (err) return next(err);
      
      // 应用速率限制
      this.rateLimiter(req, res, (err) => {
        if (err) return next(err);
        
        // 自定义安全头
        this.setCustomHeaders(res);
        
        next();
      });
    });
  }

  private setCustomHeaders(res: Response) {
    // 禁用缓存敏感数据
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY');
    
    // 内容类型选项
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // 下载选项
    res.setHeader('X-Download-Options', 'noopen');
    
    // 权限策略
    res.setHeader('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  }
}

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://baidaohui.com',
      'https://www.baidaohui.com',
      'https://gateway.baidaohui.com',
    ];

    // 开发环境允许localhost
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
    }

    // 检查来源
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    // 允许的方法
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // 允许的头部
    res.setHeader('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
    
    // 允许凭证
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // 预检请求缓存时间
    res.setHeader('Access-Control-Max-Age', '86400');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  }
}

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] as string;
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

    // 跳过公开端点
    const publicPaths = ['/health', '/metrics', '/api/auth'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // 验证API密钥
    if (!apiKey || !validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '无效的API密钥',
        statusCode: 401,
      });
    }

    next();
  }
} 