import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  FAN = 'fan',
  MEMBER = 'member',
  FIRSTMATE = 'firstmate',
  MASTER = 'master',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

@Schema({ 
  timestamps: true,
  collection: 'users'
})
export class User {
  @Prop({ required: true, unique: true })
  supabaseId: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  displayName?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ 
    type: String, 
    enum: Object.values(UserRole), 
    default: UserRole.FAN 
  })
  role: UserRole;

  @Prop({ 
    type: String, 
    enum: Object.values(UserStatus), 
    default: UserStatus.ACTIVE 
  })
  status: UserStatus;

  @Prop()
  inviteToken?: string;

  @Prop()
  invitedBy?: string;

  @Prop({ default: Date.now })
  lastLoginAt: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// 创建索引
UserSchema.index({ supabaseId: 1 }, { unique: true });
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ inviteToken: 1 }); 