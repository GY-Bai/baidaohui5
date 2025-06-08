import { createClient } from '@supabase/supabase-js';
import { StreamChat, Channel, Message, User } from 'stream-chat';

// Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Stream Chat配置（仅用于UI组件）
const apiKey = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY || 'demo-api-key';
export const chatClient = StreamChat.getInstance(apiKey);

// 禁用音频和视频功能（通过配置实现）
// chatClient.disableAudioVideo(); // 这个方法在新版本中可能不存在

export interface ChatMessage {
  id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  attachments: any[];
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
  reply_to?: {
    id: string;
    content: string;
    user: {
      id: string;
      full_name: string;
    };
  };
  reactions: Array<{
    id: string;
    reaction: string;
    user_id: string;
    user: {
      id: string;
      full_name: string;
    };
  }>;
  metadata?: any;
}

export interface ChatChannel {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'general';
  description?: string;
  created_at: string;
  updated_at: string;
  member_info: {
    role: string;
    joined_at: string;
    last_read_at: string;
    is_muted: boolean;
  };
  unread_count: number;
}

// Supabase聊天适配器类
export class SupabaseChatAdapter {
  private realtimeChannel: any;
  private currentUser: any = null;
  private currentChannel: ChatChannel | null = null;
  private authToken: string | null = null;
  private messageListeners: Array<(message: ChatMessage) => void> = [];
  private channelListeners: Array<(channels: ChatChannel[]) => void> = [];
  private typingListeners: Array<(users: string[]) => void> = [];

  constructor() {
    this.setupRealtimeSubscription();
  }

  // 初始化用户
  async connectUser(user: {
    id: string;
    name: string;
    email?: string;
    role: string;
    avatar?: string;
  }) {
    try {
      // 获取Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('用户未登录');
      }

      this.authToken = session.access_token;
      this.currentUser = user;

             // 连接到Stream Chat（仅用于UI）
       const streamUser: User = {
         id: user.id,
         name: user.name,
         role: user.role,
         image: user.avatar,
       };

      // 使用临时token连接Stream Chat
      const token = this.generateUserToken(user.id);
      await chatClient.connectUser(streamUser, token);

      // 自动加入#general频道（如果有权限）
      if (['master', 'firstmate', 'member'].includes(user.role)) {
        await this.joinGeneralChannel();
      }

      console.log('用户连接成功:', user.name);
      return true;
    } catch (error) {
      console.error('连接用户失败:', error);
      return false;
    }
  }

  // 断开用户连接
  async disconnectUser() {
    try {
      await chatClient.disconnectUser();
      this.currentUser = null;
      this.currentChannel = null;
      this.authToken = null;
      
      if (this.realtimeChannel) {
        await supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
      
      console.log('用户断开连接');
    } catch (error) {
      console.error('断开连接失败:', error);
    }
  }

  // 获取用户频道列表
  async getChannels(): Promise<ChatChannel[]> {
    try {
      if (!this.authToken) {
        throw new Error('用户未认证');
      }

      const response = await fetch('/api/chat/channels', {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取频道列表失败');
      }

      const data = await response.json();
      return data.channels || [];
    } catch (error) {
      console.error('获取频道失败:', error);
      return [];
    }
  }

  // 创建或获取频道
  async getChannel(channelId: string): Promise<ChatChannel | null> {
    try {
      const channels = await this.getChannels();
      return channels.find(ch => ch.id === channelId) || null;
    } catch (error) {
      console.error('获取频道失败:', error);
      return null;
    }
  }

  // 创建私聊频道
  async createDirectChannel(targetUserId: string, targetUserName: string): Promise<ChatChannel | null> {
    try {
      if (!this.authToken) {
        throw new Error('用户未认证');
      }

      const response = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          name: `${this.currentUser.name} & ${targetUserName}`,
          type: 'direct',
          members: [targetUserId],
        }),
      });

      if (!response.ok) {
        throw new Error('创建私聊频道失败');
      }

      const data = await response.json();
      return data.channel;
    } catch (error) {
      console.error('创建私聊频道失败:', error);
      return null;
    }
  }

  // 获取频道消息
  async getMessages(channelId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
    try {
      if (!this.authToken) {
        throw new Error('用户未认证');
      }

      const params = new URLSearchParams({
        limit: limit.toString(),
      });
      if (before) {
        params.append('before', before);
      }

      const response = await fetch(`/api/chat/channels/${channelId}/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取消息失败');
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('获取消息失败:', error);
      return [];
    }
  }

  // 发送消息
  async sendMessage(channelId: string, content: string, attachments?: any[], replyTo?: string): Promise<ChatMessage | null> {
    try {
      if (!this.authToken) {
        throw new Error('用户未认证');
      }

      const response = await fetch(`/api/chat/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          content,
          attachments: attachments || [],
          reply_to: replyTo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '发送消息失败');
      }

      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  // 删除/撤回消息
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      if (!this.authToken) {
        throw new Error('用户未认证');
      }

      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '删除消息失败');
      }

      return true;
    } catch (error) {
      console.error('删除消息失败:', error);
      throw error;
    }
  }

  // 编辑消息
  async editMessage(messageId: string, content: string): Promise<ChatMessage | null> {
    try {
      if (!this.authToken) {
        throw new Error('用户未认证');
      }

      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '编辑消息失败');
      }

      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error('编辑消息失败:', error);
      throw error;
    }
  }

  // 标记已读
  async markRead(channelId: string, messageId?: string): Promise<boolean> {
    try {
      if (!this.authToken) {
        throw new Error('用户未认证');
      }

      const response = await fetch('/api/chat/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          channel_id: channelId,
          message_id: messageId,
        }),
      });

      if (!response.ok) {
        throw new Error('标记已读失败');
      }

      return true;
    } catch (error) {
      console.error('标记已读失败:', error);
      return false;
    }
  }

  // 上传文件到R2
  async uploadFile(file: File, channelId: string): Promise<string | null> {
    try {
      // 生成唯一文件名
      const fileExtension = file.name.split('.').pop();
      const fileName = `chat/${channelId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

      // 上传到Supabase Storage (R2)
      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      // 获取公共URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('文件上传失败:', error);
      return null;
    }
  }

  // 自动加入#general频道
  private async joinGeneralChannel() {
    try {
      const generalChannelId = '00000000-0000-0000-0000-000000000001';
      
      // 检查是否已经是成员
      const { data: membership } = await supabase
        .from('chat_channel_members')
        .select('id')
        .eq('channel_id', generalChannelId)
        .eq('user_id', this.currentUser.id)
        .single();

      if (!membership) {
        // 加入频道
        await supabase
          .from('chat_channel_members')
          .insert({
            channel_id: generalChannelId,
            user_id: this.currentUser.id,
            role: 'member',
          });
      }
    } catch (error) {
      console.error('加入#general频道失败:', error);
    }
  }

  // 设置实时订阅
  private setupRealtimeSubscription() {
    this.realtimeChannel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => this.handleNewMessage(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => this.handleMessageUpdate(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_unread_counts',
        },
        (payload) => this.handleUnreadUpdate(payload.new)
      )
      .subscribe();
  }

  // 处理新消息
  private handleNewMessage(messageData: any) {
    // 通知消息监听器
    this.messageListeners.forEach(listener => {
      listener(messageData);
    });
  }

  // 处理消息更新
  private handleMessageUpdate(messageData: any) {
    // 通知消息监听器
    this.messageListeners.forEach(listener => {
      listener(messageData);
    });
  }

  // 处理未读计数更新
  private handleUnreadUpdate(unreadData: any) {
    // 通知频道监听器
    this.channelListeners.forEach(listener => {
      // 这里需要重新获取频道列表
      this.getChannels().then(channels => {
        listener(channels);
      });
    });
  }

  // 添加消息监听器
  onMessage(listener: (message: ChatMessage) => void) {
    this.messageListeners.push(listener);
  }

  // 添加频道监听器
  onChannelUpdate(listener: (channels: ChatChannel[]) => void) {
    this.channelListeners.push(listener);
  }

  // 添加正在输入监听器
  onTyping(listener: (users: string[]) => void) {
    this.typingListeners.push(listener);
  }

  // 移除监听器
  removeListener(listener: Function) {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
    this.channelListeners = this.channelListeners.filter(l => l !== listener);
    this.typingListeners = this.typingListeners.filter(l => l !== listener);
  }

  // 生成临时用户token（仅用于Stream Chat UI）
  private generateUserToken(userId: string): string {
    // 这里应该从后端获取真实的JWT token
    // 暂时使用简单的token生成
    return `temp-token-${userId}-${Date.now()}`;
  }

  // 检查用户权限
  checkUserPermission(userRole: string, action: string): boolean {
    const permissions: Record<string, string[]> = {
      fan: [],
      member: ['send_message_direct'],
      seller: ['send_message_direct', 'send_message_group'],
      master: ['send_message_direct', 'send_message_group', 'send_message_general', 'create_channel', 'delete_message'],
      firstmate: ['send_message_direct', 'send_message_group', 'send_message_general', 'create_channel', 'delete_message'],
    };

    return permissions[userRole]?.includes(action) || false;
  }

  // 获取当前用户
  getCurrentUser() {
    return this.currentUser;
  }

  // 获取当前频道
  getCurrentChannel() {
    return this.currentChannel;
  }

  // 设置当前频道
  setCurrentChannel(channel: ChatChannel | null) {
    this.currentChannel = channel;
  }
}

// 导出单例实例
export const supabaseChatAdapter = new SupabaseChatAdapter(); 