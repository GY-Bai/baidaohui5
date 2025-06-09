import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import Stripe from 'stripe';

@Injectable()
export class FortuneService {
  private stripe: Stripe;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
  }

  // 创建新订单
  async createOrder(orderData: {
    user_id: string;
    amount: number;
    message?: string;
    is_urgent?: boolean;
    images?: string[];
  }): Promise<{ order: Order; stripe_url: string }> {
    const order = new this.orderModel({
      ...orderData,
      status: 'pending',
    });

    await order.save();

    // 创建Stripe Checkout Session
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: '算命服务',
              description: orderData.message || '算命咨询服务',
            },
            unit_amount: Math.round(orderData.amount * 100), // Stripe使用分为单位
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/fortune/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/fortune/cancel`,
      metadata: {
        order_id: (order._id as any).toString(),
      },
    });

    // 更新订单的Stripe session ID
    order.stripe_checkout_session_id = session.id;
    await order.save();

    return {
      order: order.toObject(),
      stripe_url: session.url || '',
    };
  }

  // 获取订单排名
  async getOrderRank(amount: number, isUrgent: boolean): Promise<number> {
    // 计算当前排名：比当前条件更优先的订单数量 + 1
    const higherPriorityCount = await this.orderModel.countDocuments({
      status: { $in: ['paid-queued', 'processing'] },
      $or: [
        // 紧急订单优先
        { is_urgent: true, $expr: { $gt: [isUrgent, false] } },
        // 同等紧急程度下，金额更高的优先
        { 
          is_urgent: isUrgent,
          amount: { $gt: amount }
        },
        // 同等条件下，提交时间更早的优先
        {
          is_urgent: isUrgent,
          amount: amount,
          created_at: { $lt: new Date() }
        }
      ]
    });

    return higherPriorityCount + 1;
  }

  // 处理Stripe Webhook
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handlePaymentSuccess(session);
        break;
      case 'payment_intent.payment_failed':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentFailed(paymentIntent);
        break;
    }
  }

  // 处理支付成功
  private async handlePaymentSuccess(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.order_id;
    if (!orderId) return;

    await this.orderModel.findByIdAndUpdate(orderId, {
      status: 'paid-queued',
      stripe_payment_intent_id: session.payment_intent,
      updated_at: new Date(),
    });
  }

  // 处理支付失败
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    // 根据payment_intent查找订单并更新状态
    await this.orderModel.findOneAndUpdate(
      { stripe_payment_intent_id: paymentIntent.id },
      {
        status: 'pending',
        updated_at: new Date(),
      }
    );
  }

  // 获取订单列表
  async getOrders(
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ orders: Order[]; total: number }> {
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(query)
        .sort({ is_urgent: -1, amount: -1, created_at: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(query),
    ]);

    return {
      orders: orders.map(order => order.toObject()),
      total,
    };
  }

  // 更新订单状态
  async updateOrderStatus(orderId: string, status: string, reply?: string): Promise<Order | null> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (reply) {
      updateData.reply = reply;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date();
    }

    const order = await this.orderModel.findByIdAndUpdate(
      orderId,
      updateData,
      { new: true }
    );

    return order?.toObject() || null;
  }
} 