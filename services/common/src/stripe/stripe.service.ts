import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeConfigService } from './stripe-config.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripeClients: Map<string, Stripe> = new Map();
  
  constructor(private configService: StripeConfigService) {}
  
  async getStripeClient(sellerId?: string): Promise<Stripe> {
    const key = sellerId || 'default';
    
    if (!this.stripeClients.has(key)) {
      try {
        const config = await this.configService.getStripeConfig(sellerId);
        const stripe = new Stripe(config.secretKey, {
          apiVersion: '2023-10-16'
        });
        this.stripeClients.set(key, stripe);
        this.logger.log(`Stripe客户端创建成功: ${key}`);
      } catch (error) {
        this.logger.error(`创建Stripe客户端失败: ${key}`, error);
        throw error;
      }
    }
    
    return this.stripeClients.get(key)!;
  }
  
  async createPaymentIntent(
    amount: number, 
    currency: string, 
    sellerId?: string,
    metadata?: Record<string, string>
  ) {
    const stripe = await this.getStripeClient(sellerId);
    return stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata
    });
  }

  async createCheckoutSession(
    lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
    sellerId?: string,
    metadata?: Record<string, string>
  ) {
    const stripe = await this.getStripeClient(sellerId);
    
    return stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata
    });
  }
  
  async verifyWebhook(payload: string, signature: string, sellerId?: string) {
    const config = await this.configService.getStripeConfig(sellerId);
    const stripe = await this.getStripeClient(sellerId);
    
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      config.webhookSecret
    );
  }

  async retrievePaymentIntent(paymentIntentId: string, sellerId?: string) {
    const stripe = await this.getStripeClient(sellerId);
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async retrieveCheckoutSession(sessionId: string, sellerId?: string) {
    const stripe = await this.getStripeClient(sellerId);
    return stripe.checkout.sessions.retrieve(sessionId);
  }

  // 清理缓存的客户端（当配置更新时调用）
  clearClientCache(sellerId?: string) {
    const key = sellerId || 'default';
    this.stripeClients.delete(key);
    this.logger.log(`Stripe客户端缓存已清理: ${key}`);
  }
} 