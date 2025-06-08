import { Injectable } from '@nestjs/common';
import { Message, ReadReceipt } from './schemas/message.schema';

@Injectable()
export class MessageService {
  private readReceipts: Map<string, ReadReceipt[]> = new Map(); // messageId -> ReadReceipt[]
  private typingUsers: Map<string, Set<string>> = new Map(); // channelId -> Set of userIds

  // 已读回执管理
  async markMessageAsRead(messageId: string, userId: string): Promise<ReadReceipt> {
    const receipt: ReadReceipt = {
      id: this.generateId(),
      message_id: messageId,
      user_id: userId,
      read_at: new Date(),
    };

    if (!this.readReceipts.has(messageId)) {
      this.readReceipts.set(messageId, []);
    }

    const receipts = this.readReceipts.get(messageId)!;
    
    // 检查是否已经标记为已读
    const existingReceipt = receipts.find(r => r.user_id === userId);
    if (!existingReceipt) {
      receipts.push(receipt);
    }

    return receipt;
  }

  async getMessageReadReceipts(messageId: string): Promise<ReadReceipt[]> {
    return this.readReceipts.get(messageId) || [];
  }

  async getUnreadCount(channelId: string, userId: string, messages: Message[]): Promise<number> {
    let unreadCount = 0;
    
    for (const message of messages) {
      if (message.user_id === userId) continue; // 跳过自己发送的消息
      
      const receipts = await this.getMessageReadReceipts(message.id);
      const hasRead = receipts.some(r => r.user_id === userId);
      
      if (!hasRead) {
        unreadCount++;
      }
    }
    
    return unreadCount;
  }

  // 正在输入状态管理
  setUserTyping(channelId: string, userId: string): void {
    if (!this.typingUsers.has(channelId)) {
      this.typingUsers.set(channelId, new Set());
    }
    
    this.typingUsers.get(channelId)!.add(userId);
    
    // 5秒后自动清除输入状态
    setTimeout(() => {
      this.clearUserTyping(channelId, userId);
    }, 5000);
  }

  clearUserTyping(channelId: string, userId: string): void {
    const typingInChannel = this.typingUsers.get(channelId);
    if (typingInChannel) {
      typingInChannel.delete(userId);
      if (typingInChannel.size === 0) {
        this.typingUsers.delete(channelId);
      }
    }
  }

  getTypingUsers(channelId: string): string[] {
    const typingSet = this.typingUsers.get(channelId);
    return typingSet ? Array.from(typingSet) : [];
  }

  // 消息统计
  async getChannelMessageStats(channelId: string, messages: Message[]): Promise<{
    totalMessages: number;
    activeMessages: number;
    deletedMessages: number;
    lastMessageAt?: Date;
  }> {
    const channelMessages = messages.filter(msg => msg.channel_id === channelId);
    const activeMessages = channelMessages.filter(msg => !msg.is_deleted);
    const deletedMessages = channelMessages.filter(msg => msg.is_deleted);
    
    const lastMessage = activeMessages[activeMessages.length - 1];
    
    return {
      totalMessages: channelMessages.length,
      activeMessages: activeMessages.length,
      deletedMessages: deletedMessages.length,
      lastMessageAt: lastMessage?.created_at,
    };
  }

  // 消息搜索
  async searchMessages(
    channelId: string, 
    query: string, 
    messages: Message[],
    limit = 20
  ): Promise<Message[]> {
    const channelMessages = messages.filter(
      msg => msg.channel_id === channelId && !msg.is_deleted
    );
    
    const searchResults = channelMessages.filter(msg => 
      msg.content.toLowerCase().includes(query.toLowerCase())
    );
    
    return searchResults.slice(0, limit);
  }

  // 消息提及检测
  extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }

  // 消息验证
  validateMessage(content: string, messageType: string): { isValid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: '消息内容不能为空' };
    }
    
    if (content.length > 2000) {
      return { isValid: false, error: '消息内容不能超过2000字符' };
    }
    
    if (messageType === 'text' && content.trim().length === 0) {
      return { isValid: false, error: '文本消息不能为空' };
    }
    
    return { isValid: true };
  }

  // 工具方法
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 