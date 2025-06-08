import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
  stripeEvent?: any;
}

@Injectable()
export class StripeWebhookMiddleware implements NestMiddleware {
  private readonly logger = new Logger(StripeWebhookMiddleware.name);
  private readonly processedEvents = new Set<string>();
  private readonly eventTTL = 24 * 60 * 60 * 1000; // 24小时

  constructor() {
    // 定期清理过期的事件ID
    setInterval(() => {
      this.cleanupExpiredEvents();
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  async use(req: StripeWebhookRequest, res: Response, next: NextFunction) {
    try {
      // 验证Stripe签名
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        this.logger.warn('Missing Stripe signature');
        return res.status(400).json({
          error: 'Missing signature',
          message: '缺少Stripe签名',
        });
      }

      // 获取原始请求体
      const payload = req.rawBody || Buffer.from('');
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        this.logger.error('Missing Stripe webhook secret');
        return res.status(500).json({
          error: 'Configuration error',
          message: '服务器配置错误',
        });
      }

      // 验证Stripe签名
      const isValidSignature = this.verifyStripeSignature(
        payload,
        signature,
        endpointSecret
      );

      if (!isValidSignature) {
        this.logger.warn('Invalid Stripe signature');
        return res.status(400).json({
          error: 'Invalid signature',
          message: '无效的签名',
        });
      }

      // 解析事件
      let event;
      try {
        event = JSON.parse(payload.toString());
      } catch (err) {
        this.logger.error('Failed to parse webhook payload', err);
        return res.status(400).json({
          error: 'Invalid payload',
          message: '无效的请求体',
        });
      }

      // 检查事件ID去重
      const eventId = event.id;
      if (!eventId) {
        this.logger.warn('Missing event ID');
        return res.status(400).json({
          error: 'Missing event ID',
          message: '缺少事件ID',
        });
      }

      // 检查是否已处理过此事件
      if (this.isEventProcessed(eventId)) {
        this.logger.info(`Duplicate event ignored: ${eventId}`);
        return res.status(200).json({
          message: 'Event already processed',
          eventId,
        });
      }

      // 标记事件为已处理
      this.markEventAsProcessed(eventId);

      // 将事件附加到请求对象
      req.stripeEvent = event;

      // 记录事件
      this.logger.log(`Processing Stripe event: ${event.type} (${eventId})`);

      next();
    } catch (error) {
      this.logger.error('Stripe webhook middleware error', error);
      res.status(500).json({
        error: 'Internal server error',
        message: '服务器内部错误',
      });
    }
  }

  private verifyStripeSignature(
    payload: Buffer,
    signature: string,
    secret: string
  ): boolean {
    try {
      const elements = signature.split(',');
      const signatureElements: { [key: string]: string } = {};

      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureElements[key] = value;
      }

      const timestamp = signatureElements.t;
      const v1 = signatureElements.v1;

      if (!timestamp || !v1) {
        return false;
      }

      // 检查时间戳（防止重放攻击）
      const timestampNumber = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const tolerance = 300; // 5分钟容差

      if (Math.abs(currentTime - timestampNumber) > tolerance) {
        this.logger.warn('Stripe webhook timestamp too old');
        return false;
      }

      // 计算期望的签名
      const signedPayload = timestamp + '.' + payload.toString();
      const expectedSignature = createHash('sha256')
        .update(signedPayload, 'utf8')
        .update(secret, 'utf8')
        .digest('hex');

      // 使用时间安全的比较
      return this.secureCompare(v1, expectedSignature);
    } catch (error) {
      this.logger.error('Error verifying Stripe signature', error);
      return false;
    }
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  private isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  private markEventAsProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    
    // 设置过期时间（简单实现，生产环境建议使用Redis）
    setTimeout(() => {
      this.processedEvents.delete(eventId);
    }, this.eventTTL);
  }

  private cleanupExpiredEvents(): void {
    // 在实际实现中，如果使用Redis，这里可以清理过期的键
    // 当前内存实现会自动通过setTimeout清理
    this.logger.debug('Cleaning up expired webhook events');
  }
}

// 用于解析原始请求体的中间件
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: StripeWebhookRequest, res: Response, next: NextFunction) {
    if (req.headers['content-type'] === 'application/json') {
      let data = '';
      req.setEncoding('utf8');
      
      req.on('data', (chunk) => {
        data += chunk;
      });
      
      req.on('end', () => {
        req.rawBody = Buffer.from(data, 'utf8');
        next();
      });
    } else {
      next();
    }
  }
} 