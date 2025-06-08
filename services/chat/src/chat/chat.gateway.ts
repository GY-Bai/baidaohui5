import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { ThumbnailService } from './thumbnail.service';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  channelId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
    private readonly thumbnailService: ThumbnailService,
  ) {}

  // 连接处理
  async handleConnection(client: AuthenticatedSocket) {
    console.log('客户端连接:', client.url);
    
    // 这里应该从JWT token或其他方式获取用户信息
    // 暂时使用模拟数据
    const userId = this.extractUserIdFromConnection(client);
    const userRole = this.extractUserRoleFromConnection(client);
    
    if (!userId) {
      client.close(1008, '未授权的连接');
      return;
    }

    client.userId = userId;
    client.userRole = userRole;
    
    this.chatService.addUserConnection(userId, client.url || '');
    
    // 发送用户的频道列表
    const channels = await this.chatService.getUserChannels(userId);
    this.sendToClient(client, 'channels', { channels });
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.chatService.removeUserConnection(client.userId, client.url || '');
      
      // 清除输入状态
      if (client.channelId) {
        this.messageService.clearUserTyping(client.channelId, client.userId);
        this.broadcastToChannel(client.channelId, 'typing_stopped', {
          userId: client.userId,
          channelId: client.channelId,
        });
      }
    }
    
    console.log('客户端断开连接:', client.url);
  }

  // 加入频道
  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string }
  ) {
    const { channelId } = data;
    const userId = client.userId!;
    const userRole = client.userRole!;

    // 检查权限
    const canAccess = await this.chatService.canUserAccessChannel(userId, channelId, userRole);
    if (!canAccess) {
      this.sendToClient(client, 'error', { message: '无权访问此频道' });
      return;
    }

    client.channelId = channelId;
    
    // 获取频道消息
    const messages = await this.chatService.getMessages(channelId);
    
    // 为Member用户过滤#general频道消息
    let filteredMessages = messages;
    if (userRole === 'member') {
      const channel = await this.chatService.getChannel(channelId);
      if (channel?.name === 'general') {
        // Member只能看到自己和Master的消息
        filteredMessages = messages.filter(msg => 
          msg.user_id === userId || this.isMasterMessage(msg.user_id)
        );
      }
    }

    this.sendToClient(client, 'channel_joined', {
      channelId,
      messages: filteredMessages,
    });

    // 标记消息为已读
    for (const message of filteredMessages) {
      if (message.user_id !== userId) {
        await this.messageService.markMessageAsRead(message.id, userId);
      }
    }
  }

  // 发送消息
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      channelId: string;
      content: string;
      messageType: 'text' | 'image' | 'file';
      metadata?: any;
    }
  ) {
    const { channelId, content, messageType, metadata } = data;
    const userId = client.userId!;
    const userRole = client.userRole!;

    // 检查发送权限
    const canSend = await this.chatService.canUserSendMessage(userId, channelId, userRole);
    if (!canSend) {
      this.sendToClient(client, 'error', { message: '无权在此频道发送消息' });
      return;
    }

    // 验证消息
    const validation = this.messageService.validateMessage(content, messageType);
    if (!validation.isValid) {
      this.sendToClient(client, 'error', { message: validation.error });
      return;
    }

    // 创建消息
    const message = await this.chatService.sendMessage({
      channel_id: channelId,
      user_id: userId,
      content,
      message_type: messageType,
      metadata,
    });

    // 广播消息到频道
    this.broadcastToChannel(channelId, 'new_message', { message });

    // 清除输入状态
    this.messageService.clearUserTyping(channelId, userId);
    this.broadcastToChannel(channelId, 'typing_stopped', {
      userId,
      channelId,
    });

    // 发送确认
    this.sendToClient(client, 'message_sent', { messageId: message.id });
  }

  // 删除消息
  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string }
  ) {
    const { messageId } = data;
    const userId = client.userId!;

    const success = await this.chatService.deleteMessage(messageId, userId);
    
    if (success) {
      // 广播消息删除事件
      this.server.clients.forEach((clientSocket) => {
        const authSocket = clientSocket as AuthenticatedSocket;
        if (authSocket.channelId) {
          this.sendToClient(authSocket, 'message_deleted', { messageId });
        }
      });
      
      this.sendToClient(client, 'message_delete_success', { messageId });
    } else {
      this.sendToClient(client, 'error', { message: '删除消息失败' });
    }
  }

  // 输入状态
  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string }
  ) {
    const { channelId } = data;
    const userId = client.userId!;

    this.messageService.setUserTyping(channelId, userId);
    
    this.broadcastToChannel(channelId, 'typing_started', {
      userId,
      channelId,
    }, [userId]); // 排除自己
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string }
  ) {
    const { channelId } = data;
    const userId = client.userId!;

    this.messageService.clearUserTyping(channelId, userId);
    
    this.broadcastToChannel(channelId, 'typing_stopped', {
      userId,
      channelId,
    });
  }

  // 标记消息已读
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string }
  ) {
    const { messageId } = data;
    const userId = client.userId!;

    await this.messageService.markMessageAsRead(messageId, userId);
    
    this.sendToClient(client, 'message_read', { messageId, userId });
  }

  // 获取在线用户
  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string }
  ) {
    const { channelId } = data;
    const channel = await this.chatService.getChannel(channelId);
    
    if (!channel) {
      this.sendToClient(client, 'error', { message: '频道不存在' });
      return;
    }

    const onlineUsers = channel.participants.filter(userId => 
      this.chatService.isUserOnline(userId)
    );

    this.sendToClient(client, 'online_users', {
      channelId,
      onlineUsers,
    });
  }

  // 工具方法
  private sendToClient(client: AuthenticatedSocket, event: string, data: any) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  private broadcastToChannel(
    channelId: string, 
    event: string, 
    data: any, 
    excludeUsers: string[] = []
  ) {
    this.server.clients.forEach((client) => {
      const authSocket = client as AuthenticatedSocket;
      if (
        authSocket.channelId === channelId &&
        authSocket.userId &&
        !excludeUsers.includes(authSocket.userId)
      ) {
        this.sendToClient(authSocket, event, data);
      }
    });
  }

  private extractUserIdFromConnection(client: AuthenticatedSocket): string | null {
    // 这里应该从JWT token或查询参数中提取用户ID
    // 暂时返回模拟数据
    const url = new URL(client.url || '', 'ws://localhost');
    return url.searchParams.get('userId');
  }

  private extractUserRoleFromConnection(client: AuthenticatedSocket): string {
    // 这里应该从JWT token或查询参数中提取用户角色
    // 暂时返回模拟数据
    const url = new URL(client.url || '', 'ws://localhost');
    return url.searchParams.get('userRole') || 'fan';
  }

  private isMasterMessage(userId: string): boolean {
    // 这里应该查询用户角色
    // 暂时简化处理
    return userId.includes('master');
  }
} 