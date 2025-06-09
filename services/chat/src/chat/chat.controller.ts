import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { ThumbnailService } from './thumbnail.service';

// 简化的认证守卫，实际应该使用JWT
class AuthGuard {
  canActivate(): boolean {
    return true; // 暂时允许所有请求
  }
}

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
    private readonly thumbnailService: ThumbnailService,
  ) {}

  // 获取用户频道列表
  @Get('channels')
  async getUserChannels(@Request() req: any) {
    const userId = req.user?.id || 'test-user'; // 暂时使用测试用户
    const channels = await this.chatService.getUserChannels(userId);
    
    return {
      success: true,
      data: { channels },
    };
  }

  // 创建频道
  @Post('channels')
  async createChannel(@Request() req: any, @Body() body: {
    name: string;
    type: 'direct' | 'group' | 'general';
    participants: string[];
  }) {
    const userId = req.user?.id || 'test-user';
    
    const channel = await this.chatService.createChannel({
      name: body.name,
      type: body.type,
      participants: [...body.participants, userId],
      created_by: userId,
    });

    return {
      success: true,
      data: { channel },
    };
  }

  // 获取或创建私聊频道
  @Post('channels/direct')
  async getOrCreateDirectChannel(@Request() req: any, @Body() body: {
    targetUserId: string;
  }) {
    const userId = req.user?.id || 'test-user';
    const { targetUserId } = body;

    // 检查是否已存在私聊频道
    let channel = await this.chatService.getDirectChannel(userId, targetUserId);
    
    if (!channel) {
      // 创建新的私聊频道
      channel = await this.chatService.createChannel({
        name: '',
        type: 'direct',
        participants: [userId, targetUserId],
        created_by: userId,
      });
    }

    return {
      success: true,
      data: { channel },
    };
  }

  // 获取频道消息
  @Get('channels/:channelId/messages')
  async getChannelMessages(
    @Request() req: any,
    @Param('channelId') channelId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    // 检查权限
    const canAccess = await this.chatService.canUserAccessChannel(userId, channelId, userRole);
    if (!canAccess) {
      return {
        success: false,
        error: '无权访问此频道',
      };
    }

    const messages = await this.chatService.getMessages(
      channelId,
      limit ? parseInt(limit) : 50,
      before,
    );

    // 为Member用户过滤#general频道消息
    let filteredMessages = messages;
    if (userRole === 'member') {
      const channel = await this.chatService.getChannel(channelId);
      if (channel?.name === 'general') {
        filteredMessages = messages.filter(msg => 
          msg.user_id === userId || this.isMasterMessage(msg.user_id)
        );
      }
    }

    return {
      success: true,
      data: { messages: filteredMessages },
    };
  }

  // 发送文本消息
  @Post('channels/:channelId/messages')
  async sendMessage(
    @Request() req: any,
    @Param('channelId') channelId: string,
    @Body() body: {
      content: string;
      replyTo?: string;
    }
  ) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    // 检查发送权限
    const canSend = await this.chatService.canUserSendMessage(userId, channelId, userRole);
    if (!canSend) {
      return {
        success: false,
        error: '无权在此频道发送消息',
      };
    }

    // 验证消息
    const validation = this.messageService.validateMessage(body.content, 'text');
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const message = await this.chatService.sendMessage({
      channel_id: channelId,
      user_id: userId,
      content: body.content,
      message_type: 'text',
      reply_to: body.replyTo,
    });

    return {
      success: true,
      data: { message },
    };
  }

  // 上传文件消息
  @Post('channels/:channelId/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Request() req: any,
    @Param('channelId') channelId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    // 检查发送权限
    const canSend = await this.chatService.canUserSendMessage(userId, channelId, userRole);
    if (!canSend) {
      return {
        success: false,
        error: '无权在此频道发送文件',
      };
    }

    if (!file) {
      return {
        success: false,
        error: '未选择文件',
      };
    }

    // 验证文件
    const validation = this.thumbnailService.validateFile(file.buffer, file.originalname);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    try {
      let metadata: any;
      let messageType: 'image' | 'file';

      if (this.thumbnailService.isImageFile(file.originalname)) {
        // 处理图片
        const imageData = await this.thumbnailService.processImageMessage(
          file.buffer,
          file.originalname,
        );
        
        messageType = 'image';
        metadata = {
          file_url: imageData.imageUrl,
          thumbnail_url: imageData.thumbnailUrl,
          image_width: imageData.width,
          image_height: imageData.height,
          file_name: file.originalname,
          file_size: file.size,
        };
      } else {
        // 处理普通文件
        const fileData = await this.thumbnailService.processFileMessage(
          file.buffer,
          file.originalname,
          this.thumbnailService.getContentType(file.originalname),
        );
        
        messageType = 'file';
        metadata = {
          file_url: fileData.fileUrl,
          file_name: fileData.fileName,
          file_size: fileData.fileSize,
        };
      }

      const message = await this.chatService.sendMessage({
        channel_id: channelId,
        user_id: userId,
        content: file.originalname,
        message_type: messageType,
        metadata,
      });

      return {
        success: true,
        data: { message },
      };
    } catch (error) {
      return {
        success: false,
        error: '文件上传失败',
      };
    }
  }

  // 删除消息
  @Delete('messages/:messageId')
  async deleteMessage(
    @Request() req: any,
    @Param('messageId') messageId: string,
  ) {
    const userId = req.user?.id || 'test-user';
    
    const success = await this.chatService.deleteMessage(messageId, userId);
    
    return {
      success,
      message: success ? '消息删除成功' : '删除消息失败',
    };
  }

  // 标记消息已读
  @Put('messages/:messageId/read')
  async markMessageRead(
    @Request() req: any,
    @Param('messageId') messageId: string,
  ) {
    const userId = req.user?.id || 'test-user';
    
    const receipt = await this.messageService.markMessageAsRead(messageId, userId);
    
    return {
      success: true,
      data: { receipt },
    };
  }

  // 获取频道统计
  @Get('channels/:channelId/stats')
  async getChannelStats(
    @Request() req: any,
    @Param('channelId') channelId: string,
  ) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    // 检查权限
    const canAccess = await this.chatService.canUserAccessChannel(userId, channelId, userRole);
    if (!canAccess) {
      return {
        success: false,
        error: '无权访问此频道',
      };
    }

    const messages = await this.chatService.getMessages(channelId, 1000); // 获取更多消息用于统计
    const stats = await this.messageService.getChannelMessageStats(channelId, messages);
    const unreadCount = await this.messageService.getUnreadCount(channelId, userId, messages);

    return {
      success: true,
      data: {
        ...stats,
        unreadCount,
      },
    };
  }

  // 搜索消息
  @Get('channels/:channelId/search')
  async searchMessages(
    @Request() req: any,
    @Param('channelId') channelId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    // 检查权限
    const canAccess = await this.chatService.canUserAccessChannel(userId, channelId, userRole);
    if (!canAccess) {
      return {
        success: false,
        error: '无权访问此频道',
      };
    }

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: '搜索关键词不能为空',
      };
    }

    const messages = await this.chatService.getMessages(channelId, 1000);
    const searchResults = await this.messageService.searchMessages(
      channelId,
      query,
      messages,
      limit ? parseInt(limit) : 20,
    );

    return {
      success: true,
      data: { messages: searchResults },
    };
  }

  // 工具方法
  private isMasterMessage(userId: string): boolean {
    // 这里应该查询用户角色
    // 暂时简化处理
    return userId.includes('master');
  }
} 