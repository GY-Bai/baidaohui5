import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AiProxyService, ChatRequest } from './ai-proxy.service';
import { RateLimitService } from './rate-limit.service';

// 简化的认证守卫
class AuthGuard {
  canActivate(): boolean {
    return true; // 暂时允许所有请求
  }
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

interface ErrorResponse {
  message?: string;
  status?: number;
}

@Controller('ai')
@UseGuards(AuthGuard)
export class AiProxyController {
  constructor(
    private readonly aiProxyService: AiProxyService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  // 聊天接口
  @Post('chat')
  async chat(@Request() req: AuthenticatedRequest, @Body() body: ChatRequest) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    try {
      const response = await this.aiProxyService.chat(body, userId, userRole);
      return {
        success: true,
        data: response,
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || 'AI服务不可用',
        status: errorResponse.status || 500,
      };
    }
  }

  // 流式聊天接口
  @Post('chat/stream')
  async chatStream(
    @Request() req: AuthenticatedRequest,
    @Body() body: ChatRequest,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    try {
      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      const stream = await this.aiProxyService.chatStream(body, userId, userRole);

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      res.status(errorResponse.status || 500).json({
        success: false,
        error: errorResponse.message || 'AI流式服务不可用',
      });
    }
  }

  // 获取可用模型
  @Get('models')
  async getModels(@Request() req: AuthenticatedRequest) {
    const userRole = req.user?.role || 'fan';

    try {
      const models = await this.aiProxyService.getModels(userRole);
      return {
        success: true,
        data: { models },
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || '获取模型列表失败',
      };
    }
  }

  // 获取用户使用统计
  @Get('usage')
  async getUserUsage(@Request() req: AuthenticatedRequest) {
    const userId = req.user?.id || 'test-user';

    try {
      const stats = await this.aiProxyService.getUserUsageStats(userId);
      const limitStatus = await this.rateLimitService.getUserLimitStatus(userId);

      return {
        success: true,
        data: {
          usage: stats,
          limits: limitStatus,
        },
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || '获取使用统计失败',
      };
    }
  }

  // 获取剩余请求次数
  @Get('limits')
  async getRemainingLimits(@Request() req: AuthenticatedRequest) {
    const userId = req.user?.id || 'test-user';
    const userRole = req.user?.role || 'member';

    try {
      // 获取用户的速率限制配置
      const limits = this.getRateLimitsForRole(userRole);
      
      const remaining = {
        minute: await this.rateLimitService.getRemainingRequests(userId, 'minute', limits.minute),
        hour: await this.rateLimitService.getRemainingRequests(userId, 'hour', limits.hour),
        day: await this.rateLimitService.getRemainingRequests(userId, 'day', limits.day),
      };

      return {
        success: true,
        data: { remaining },
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || '获取限制信息失败',
      };
    }
  }

  // 健康检查
  @Get('health')
  async healthCheck() {
    try {
      const health = await this.aiProxyService.healthCheck();
      return {
        success: true,
        data: health,
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || '健康检查失败',
      };
    }
  }

  // 管理员接口：获取服务统计
  @Get('admin/stats')
  async getAdminStats(@Request() req: AuthenticatedRequest) {
    const userRole = req.user?.role || 'fan';

    if (!['master', 'firstmate'].includes(userRole)) {
      return {
        success: false,
        error: '权限不足',
        status: 403,
      };
    }

    try {
      const rateLimitStats = await this.rateLimitService.getStats();
      const health = await this.aiProxyService.healthCheck();

      return {
        success: true,
        data: {
          rateLimits: rateLimitStats,
          health,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || '获取统计信息失败',
      };
    }
  }

  // 管理员接口：重置用户限制
  @Post('admin/reset-limits')
  async resetUserLimits(@Request() req: AuthenticatedRequest, @Body() body: { userId: string }) {
    const userRole = req.user?.role || 'fan';

    if (!['master', 'firstmate'].includes(userRole)) {
      return {
        success: false,
        error: '权限不足',
        status: 403,
      };
    }

    try {
      await this.rateLimitService.resetUserLimits(body.userId);
      return {
        success: true,
        message: `用户 ${body.userId} 的限制已重置`,
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || '重置限制失败',
      };
    }
  }

  // 管理员接口：清理过期数据
  @Post('admin/cleanup')
  async cleanup(@Request() req: AuthenticatedRequest) {
    const userRole = req.user?.role || 'fan';

    if (!['master', 'firstmate'].includes(userRole)) {
      return {
        success: false,
        error: '权限不足',
        status: 403,
      };
    }

    try {
      const result = await this.rateLimitService.cleanup();
      return {
        success: true,
        data: result,
      };
    } catch (error: unknown) {
      const errorResponse = error as ErrorResponse;
      return {
        success: false,
        error: errorResponse.message || '清理失败',
      };
    }
  }

  // 获取角色速率限制配置
  private getRateLimitsForRole(userRole: string): Record<string, number> {
    const limits: Record<string, Record<string, number>> = {
      fan: { minute: 0, hour: 0, day: 0 }, // Fan不能使用AI
      member: { minute: 5, hour: 50, day: 200 },
      seller: { minute: 10, hour: 100, day: 500 },
      master: { minute: 50, hour: 500, day: 2000 },
      firstmate: { minute: 50, hour: 500, day: 2000 },
    };

    return limits[userRole] || limits.fan;
  }
} 