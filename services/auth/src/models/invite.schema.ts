import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InviteDocument = Invite & Document;

export enum InviteStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum InviteType {
  MEMBER = 'member',
  FIRSTMATE = 'firstmate',
}

@Schema({ 
  timestamps: true,
  collection: 'invites'
})
export class Invite {
  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ 
    type: String, 
    enum: Object.values(InviteType), 
    required: true 
  })
  type: InviteType;

  @Prop({ required: true })
  createdBy: string; // User ID

  @Prop({ 
    type: String, 
    enum: Object.values(InviteStatus), 
    default: InviteStatus.ACTIVE 
  })
  status: InviteStatus;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 1 })
  maxUses: number;

  @Prop({ default: 0 })
  usedCount: number;

  @Prop()
  usedBy?: string; // User ID who used this invite

  @Prop()
  usedAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  qrCodeUrl?: string;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);

// 创建索引
InviteSchema.index({ token: 1 }, { unique: true });
InviteSchema.index({ createdBy: 1 });
InviteSchema.index({ status: 1 });
InviteSchema.index({ type: 1 });
InviteSchema.index({ expiresAt: 1 });
InviteSchema.index({ createdAt: -1 }); 