import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ default: '' })
  message: string;

  @Prop({ default: false })
  is_urgent: boolean;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ 
    required: true, 
    enum: ['pending', 'paid-queued', 'processing', 'completed', 'refunded'],
    default: 'pending'
  })
  status: string;

  @Prop()
  stripe_payment_intent_id?: string;

  @Prop()
  stripe_checkout_session_id?: string;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;

  @Prop()
  completed_at?: Date;

  @Prop()
  reply?: string;

  @Prop({ type: [String], default: [] })
  reply_images: string[];
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// 创建索引
OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ rank: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ isUrgent: -1, createdAt: 1 }); // 紧急订单优先 