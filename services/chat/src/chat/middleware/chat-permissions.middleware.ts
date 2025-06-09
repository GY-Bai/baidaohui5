import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { MongoClient, Db } from 'mongodb';

interface UserPayload {
  sub: string;
  email: string;
  role: string;
}

interface ChatRequest extends Request {
  user?: UserPayload;
  channelName?: string;
  targetUserId?: string;
  chatType?: 'channel' | 'private';
}

interface Message {
  user_id: string;
  user_role?: string;
}

@Injectable()
export class ChatPermissionsMiddleware implements NestMiddleware {
  private client: MongoClient;
  private db: Db;

  constructor(private jwtService: JwtService) {
    this.client = new MongoClient(process.env.MONGODB_URI || '');
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      await this.client.connect();
      this.db = this.client.db('baidaohui');
    } catch (error) {
      console.error('MongoDB连接失败:', error);
    }
  }

  async use(req: ChatRequest, res: Response, next: NextFunction) {
    try {
      // 提取JWT token
      const token = this.extractTokenFromHeader(req);
      if (!token) {
        throw new ForbiddenException('未提供认证token');
      }

      // 验证token并获取用户信息
      const payload = await this.jwtService.verifyAsync(token);
      req.user = payload;

      // 从请求中提取聊天相关信息
      this.extractChatInfo(req);

      // 检查聊天权限
      await this.checkChatPermissions(req);

      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('权限验证失败');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractChatInfo(req: ChatRequest) {
    // 从URL路径中提取频道名称
    const channelMatch = req.path.match(/\/channels\/([^\/]+)/);
    if (channelMatch) {
      req.channelName = channelMatch[1];
      req.chatType = 'channel';
    }

    // 从URL路径中提取私聊目标用户ID
    const privateChatMatch = req.path.match(/\/private-chats\/([^\/]+)/);
    if (privateChatMatch) {
      req.targetUserId = privateChatMatch[1];
      req.chatType = 'private';
    }

    // 从请求体中提取信息
    if (req.body) {
      if (req.body.channelName) {
        req.channelName = req.body.channelName;
        req.chatType = 'channel';
      }
      if (req.body.targetUserId) {
        req.targetUserId = req.body.targetUserId;
        req.chatType = 'private';
      }
    }
  }

  private async checkChatPermissions(req: ChatRequest) {
    const { user, channelName, targetUserId, chatType } = req;
    
    if (!user) {
      throw new ForbiddenException('用户未认证');
    }

    if (chatType === 'channel' && channelName) {
      await this.checkChannelPermissions(user, channelName, req.method);
    } else if (chatType === 'private' && targetUserId) {
      await this.checkPrivateChatPermissions(user, targetUserId);
    }
  }

  private async checkChannelPermissions(user: UserPayload, channelName: string, method: string) {
    // 规则1: fan角色不能访问#general频道
    if (user.role === 'fan' && channelName === 'general') {
      throw new ForbiddenException('粉丝用户无法访问#general频道');
    }

    // 规则2: 检查用户是否有频道访问权限
    const hasAccess = await this.checkChannelAccess(user.sub, channelName);
    if (!hasAccess) {
      throw new ForbiddenException('您没有访问此频道的权限');
    }

    // 规则3: 检查发送消息权限（POST请求）
    if (method === 'POST') {
      const canSend = await this.checkSendMessagePermission(user, channelName);
      if (!canSend) {
        throw new ForbiddenException('您没有在此频道发送消息的权限');
      }
    }
  }

  private async checkPrivateChatPermissions(user: UserPayload, targetUserId: string) {
    // 获取目标用户角色
    const targetUser = await this.getUserById(targetUserId);
    if (!targetUser) {
      throw new ForbiddenException('目标用户不存在');
    }

    // 规则1: member之间不能私聊
    if (user.role === 'member' && targetUser.role === 'member') {
      throw new ForbiddenException('会员之间无法发起私聊');
    }

    // 规则2: 不能和自己私聊
    if (user.sub === targetUserId) {
      throw new ForbiddenException('无法与自己私聊');
    }
  }

  private async checkChannelAccess(userId: string, channelName: string): Promise<boolean> {
    try {
      // 检查用户是否有特定频道权限
      const permission = await this.db.collection('chat_permissions').findOne({
        user_id: userId,
        channel_name: channelName,
        permission_type: { $in: ['read', 'write', 'admin'] }
      });

      if (permission) {
        return true;
      }

      // 检查是否为公开频道
      const channel = await this.db.collection('channels').findOne({
        name: channelName,
        type: 'public'
      });

      return !!channel;
    } catch (error) {
      console.error('检查频道访问权限失败:', error);
      return false;
    }
  }

  private async checkSendMessagePermission(user: UserPayload, channelName: string): Promise<boolean> {
    // master和firstmate可以在任何频道发送消息
    if (['master', 'firstmate'].includes(user.role)) {
      return true;
    }

    // fan不能在#general频道发送消息
    if (user.role === 'fan' && channelName === 'general') {
      return false;
    }

    // 检查用户是否有写入权限
    try {
      const permission = await this.db.collection('chat_permissions').findOne({
        user_id: user.sub,
        channel_name: channelName,
        permission_type: { $in: ['write', 'admin'] }
      });

      return !!permission;
    } catch (error) {
      console.error('检查发送消息权限失败:', error);
      return false;
    }
  }

  private async getUserById(userId: string): Promise<{ role: string } | null> {
    try {
      const user = await this.db.collection('users').findOne(
        { _id: userId },
        { projection: { role: 1 } }
      );
      return user;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}

/**
 * 消息过滤中间件
 * 实现member在#general频道只能看到自己和master的消息
 */
@Injectable()
export class MessageFilterMiddleware implements NestMiddleware {
  private client: MongoClient;
  private db: Db;

  constructor(private jwtService: JwtService) {
    this.client = new MongoClient(process.env.MONGODB_URI || '');
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      await this.client.connect();
      this.db = this.client.db('baidaohui');
    } catch (error) {
      console.error('MongoDB连接失败:', error);
    }
  }

  async use(req: ChatRequest, res: Response, next: NextFunction) {
    try {
      // 只对GET请求（获取消息）进行过滤
      if (req.method !== 'GET') {
        return next();
      }

      // 提取用户信息
      const token = this.extractTokenFromHeader(req);
      if (!token) {
        return next();
      }

      const payload = await this.jwtService.verifyAsync(token);
      req.user = payload;

      // 提取频道信息
      this.extractChatInfo(req);

      // 如果是member在#general频道，需要过滤消息
      if (req.user.role === 'member' && req.channelName === 'general') {
        // 在响应中添加消息过滤逻辑
        const originalSend = res.send;
        res.send = function(data) {
          if (typeof data === 'string') {
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.messages && Array.isArray(parsedData.messages)) {
                // 过滤消息：只显示自己和master/firstmate的消息
                parsedData.messages = parsedData.messages.filter((message: Message) => {
                  return message.user_id === req.user.sub || 
                         ['master', 'firstmate'].includes(message.user_role || '');
                });
                data = JSON.stringify(parsedData);
              }
            } catch (error) {
              // 如果不是JSON数据，直接返回
            }
          }
          return originalSend.call(this, data);
        };
      }

      next();
    } catch (error) {
      next();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractChatInfo(req: ChatRequest) {
    const channelMatch = req.path.match(/\/channels\/([^\/]+)/);
    if (channelMatch) {
      req.channelName = channelMatch[1];
    }
  }

  async onModuleDestroy() {
    await this.client.close();
  }
} 