import { Injectable } from '@nestjs/common';
import { Message, Channel } from './schemas/message.schema';

@Injectable()
export class ChatService {
  private channels: Map<string, Channel> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  // 频道管理
  async createChannel(channelData: Partial<Channel>): Promise<Channel> {
    const channel: Channel = {
      id: this.generateId(),
      name: channelData.name || '',
      type: channelData.type || 'direct',
      participants: channelData.participants || [],
      created_by: channelData.created_by || '',
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.channels.set(channel.id, channel);
    this.messages.set(channel.id, []);
    
    return channel;
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    return this.channels.get(channelId) || null;
  }

  async getUserChannels(userId: string): Promise<Channel[]> {
    const userChannels: Channel[] = [];
    
    for (const channel of this.channels.values()) {
      if (channel.participants.includes(userId)) {
        userChannels.push(channel);
      }
    }
    
    return userChannels;
  }

  async getDirectChannel(user1Id: string, user2Id: string): Promise<Channel | null> {
    for (const channel of this.channels.values()) {
      if (
        channel.type === 'direct' &&
        channel.participants.length === 2 &&
        channel.participants.includes(user1Id) &&
        channel.participants.includes(user2Id)
      ) {
        return channel;
      }
    }
    return null;
  }

  // 消息管理
  async sendMessage(messageData: Partial<Message>): Promise<Message> {
    const message: Message = {
      id: this.generateId(),
      channel_id: messageData.channel_id || '',
      user_id: messageData.user_id || '',
      content: messageData.content || '',
      message_type: messageData.message_type || 'text',
      metadata: messageData.metadata,
      reply_to: messageData.reply_to,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const channelMessages = this.messages.get(message.channel_id) || [];
    channelMessages.push(message);
    this.messages.set(message.channel_id, channelMessages);

    return message;
  }

  async getMessages(channelId: string, limit = 50, before?: string): Promise<Message[]> {
    const channelMessages = this.messages.get(channelId) || [];
    
    // 过滤已删除的消息
    const activeMessages = channelMessages.filter(msg => !msg.is_deleted);
    
    // 如果指定了before参数，获取该消息之前的消息
    let filteredMessages = activeMessages;
    if (before) {
      const beforeIndex = activeMessages.findIndex(msg => msg.id === before);
      if (beforeIndex > 0) {
        filteredMessages = activeMessages.slice(0, beforeIndex);
      }
    }
    
    // 返回最新的limit条消息
    return filteredMessages.slice(-limit);
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    for (const channelMessages of this.messages.values()) {
      const messageIndex = channelMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        const message = channelMessages[messageIndex];
        
        // 只有消息发送者可以删除消息
        if (message.user_id === userId) {
          message.is_deleted = true;
          message.deleted_at = new Date();
          message.updated_at = new Date();
          return true;
        }
      }
    }
    return false;
  }

  // 用户连接管理
  addUserConnection(userId: string, socketId: string): void {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socketId);
  }

  removeUserConnection(userId: string, socketId: string): void {
    const userSockets = this.userConnections.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  getUserConnections(userId: string): Set<string> {
    return this.userConnections.get(userId) || new Set();
  }

  isUserOnline(userId: string): boolean {
    const connections = this.userConnections.get(userId);
    return connections ? connections.size > 0 : false;
  }

  // 权限检查
  async canUserAccessChannel(userId: string, channelId: string, userRole: string): Promise<boolean> {
    const channel = await this.getChannel(channelId);
    if (!channel) return false;

    // #general频道权限检查
    if (channel.name === 'general') {
      return ['master', 'firstmate', 'member'].includes(userRole);
    }

    // 私聊频道权限检查
    if (channel.type === 'direct') {
      // Member只能与Master私聊
      if (userRole === 'member') {
        // 这里需要查询其他参与者的角色，暂时简化处理
        return channel.participants.includes(userId);
      }
      
      // Seller可以发起私聊但不能访问#general
      if (userRole === 'seller') {
        return channel.participants.includes(userId);
      }
      
      // Master和Firstmate可以访问所有私聊
      return ['master', 'firstmate'].includes(userRole);
    }

    return channel.participants.includes(userId);
  }

  async canUserSendMessage(userId: string, channelId: string, userRole: string): Promise<boolean> {
    // Fan不能发送任何消息
    if (userRole === 'fan') return false;
    
    return this.canUserAccessChannel(userId, channelId, userRole);
  }

  // 工具方法
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 