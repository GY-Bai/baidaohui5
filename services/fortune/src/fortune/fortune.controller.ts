import { Controller, Post, Get, Body, Query, Param, Patch, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { FortuneService } from './fortune.service';
import Stripe from 'stripe';

@Controller('fortune')
export class FortuneController {
  constructor(private readonly fortuneService: FortuneService) {}

  // 创建订单
  @Post('order')
  async createOrder(@Body() orderData: {
    user_id: string;
    amount: number;
    message?: string;
    is_urgent?: boolean;
    images?: string[];
  }) {
    return this.fortuneService.createOrder(orderData);
  }

  // 获取订单排名
  @Get('rank')
  async getOrderRank(
    @Query('amount') amount: string,
    @Query('is_urgent') isUrgent: string
  ) {
    const rank = await this.fortuneService.getOrderRank(
      parseFloat(amount),
      isUrgent === 'true'
    );
    return { rank };
  }

  // 获取订单列表
  @Get('orders')
  async getOrders(
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    return this.fortuneService.getOrders(
      status,
      parseInt(page),
      parseInt(limit)
    );
  }

  // 更新订单状态
  @Patch('orders/:id')
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body() updateData: { status: string; reply?: string }
  ) {
    return this.fortuneService.updateOrderStatus(
      orderId,
      updateData.status,
      updateData.reply
    );
  }

  // Stripe Webhook
  @Post('stripe/webhook')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });

    try {
      const event = stripe.webhooks.constructEvent(
        req.rawBody || Buffer.from(''),
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      await this.fortuneService.handleStripeWebhook(event);

      return { received: true };
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }
} 