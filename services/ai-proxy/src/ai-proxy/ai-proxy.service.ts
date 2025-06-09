import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { OpenRouterService } from './providers/openrouter.service';
import { GeminiService } from './providers/gemini.service';
import { SuanliService } from './providers/suanli.service';
import { RateLimitService } from './rate-limit.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class AiProxyService {
  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly geminiService: GeminiService,
    private readonly suanliService: SuanliService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  // 处理聊天请求
  async chat(request: ChatRequest, userId: string, userRole: string): Promise<ChatResponse> {
    // 检查速率限制
    await this.checkRateLimit(userId, userRole);

    // 验证请求
    this.validateChatRequest(request);

    // 选择AI提供商
    const provider = this.selectProvider(request.model, userRole);

    try {
      let response: ChatResponse;

      switch (provider) {
        case 'openrouter':
          response = await this.openRouterService.chat(request);
          break;
        case 'gemini':
          response = await this.geminiService.chat(request);
          break;
        case 'suanli':
          response = await this.suanliService.chat(request);
          break;
        default:
          throw new BadRequestException('不支持的AI提供商');
      }

      // 记录使用情况
      await this.recordUsage(userId, userRole, response.usage);

      return response;
    } catch (error) {
      console.error(`${provider}请求失败:`, error);
      
      // 智能回退：如果主要服务失败，尝试使用算力云作为备用
      if (provider !== 'suanli' && this.suanliService.isAvailable()) {
        console.log('尝试使用算力云作为备用服务...');
        try {
          const fallbackResponse = await this.suanliService.chat(request);
          await this.recordUsage(userId, userRole, fallbackResponse.usage);
          return fallbackResponse;
        } catch (fallbackError) {
          console.error('算力云备用服务也失败:', fallbackError);
        }
      }
      
      throw new BadRequestException('AI服务暂时不可用');
    }
  }

  // 流式聊天
  async chatStream(request: ChatRequest, userId: string, userRole: string): Promise<AsyncIterable<string>> {
    // 检查速率限制
    await this.checkRateLimit(userId, userRole);

    // 验证请求
    this.validateChatRequest(request);

    // 选择AI提供商
    const provider = this.selectProvider(request.model, userRole);

    try {
      switch (provider) {
        case 'openrouter':
          return this.openRouterService.chatStream(request);
        case 'gemini':
          return this.geminiService.chatStream(request);
        case 'suanli':
          return this.suanliService.chatStream(request);
        default:
          throw new BadRequestException('不支持的AI提供商');
      }
    } catch (error) {
      console.error(`${provider}流式请求失败:`, error);
      
      // 智能回退：如果主要服务失败，尝试使用算力云作为备用
      if (provider !== 'suanli' && this.suanliService.isAvailable()) {
        console.log('尝试使用算力云流式服务作为备用...');
        try {
          return this.suanliService.chatStream(request);
        } catch (fallbackError) {
          console.error('算力云备用流式服务也失败:', fallbackError);
        }
      }
      
      throw new BadRequestException('AI服务暂时不可用');
    }
  }

  // 获取可用模型列表
  async getModels(userRole: string): Promise<Array<{
    id: string;
    name: string;
    provider: string;
    description: string;
    pricing: {
      input: number;
      output: number;
    };
    context_length: number;
    available_for_role: boolean;
  }>> {
    const models = [
      // OpenRouter模型
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'openrouter',
        description: '最新的GPT-4模型，性能优异',
        pricing: { input: 0.005, output: 0.015 },
        context_length: 128000,
        available_for_role: ['master', 'firstmate'].includes(userRole),
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openrouter',
        description: '轻量版GPT-4，性价比高',
        pricing: { input: 0.00015, output: 0.0006 },
        context_length: 128000,
        available_for_role: ['master', 'firstmate', 'member'].includes(userRole),
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'openrouter',
        description: 'Anthropic最新模型，擅长推理',
        pricing: { input: 0.003, output: 0.015 },
        context_length: 200000,
        available_for_role: ['master', 'firstmate'].includes(userRole),
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B',
        provider: 'openrouter',
        description: '开源模型，免费使用',
        pricing: { input: 0, output: 0 },
        context_length: 128000,
        available_for_role: true, // 所有角色都可用
      },
      // Gemini模型
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        description: 'Google最新模型，支持多模态',
        pricing: { input: 0.00125, output: 0.005 },
        context_length: 2000000,
        available_for_role: ['master', 'firstmate', 'member'].includes(userRole),
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        description: '快速响应版本',
        pricing: { input: 0.000075, output: 0.0003 },
        context_length: 1000000,
        available_for_role: true, // 所有角色都可用
      },
      // 算力云模型（备用服务）
      {
        id: 'free:QwQ-32B',
        name: 'QwQ-32B (算力云)',
        provider: 'suanli',
        description: '免费的32B参数模型，作为备用AI服务',
        pricing: { input: 0, output: 0 },
        context_length: 32000,
        available_for_role: true, // 所有角色都可用
      },
    ];

    return models;
  }

  // 检查速率限制
  private async checkRateLimit(userId: string, userRole: string): Promise<void> {
    const limits = this.getRateLimits(userRole);
    
    for (const [period, limit] of Object.entries(limits)) {
      const isAllowed = await this.rateLimitService.checkLimit(
        userId,
        period as 'minute' | 'hour' | 'day',
        limit
      );
      
      if (!isAllowed) {
        throw new HttpException(`超过${period}速率限制`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  // 获取角色速率限制
  private getRateLimits(userRole: string): Record<string, number> {
    const limits: Record<string, Record<string, number>> = {
      fan: { minute: 0, hour: 0, day: 0 }, // Fan不能使用AI
      member: { minute: 5, hour: 50, day: 200 },
      seller: { minute: 10, hour: 100, day: 500 },
      master: { minute: 50, hour: 500, day: 2000 },
      firstmate: { minute: 50, hour: 500, day: 2000 },
    };

    return limits[userRole] || limits.fan;
  }

  // 选择AI提供商
  private selectProvider(model?: string, userRole?: string): string {
    if (model) {
      if (model.startsWith('gemini')) return 'gemini';
      if (model.startsWith('free:') || model.includes('QwQ')) return 'suanli';
      if (model.includes('/')) return 'openrouter';
    }

    // 检查各服务是否可用，优先使用配置的服务
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasSuanliKey = this.suanliService.isAvailable();

    // 默认策略：根据角色和可用性选择
    if (['master', 'firstmate'].includes(userRole || '')) {
      // 高级用户优先使用OpenRouter
      if (hasOpenRouterKey) return 'openrouter';
      if (hasGeminiKey) return 'gemini';
      if (hasSuanliKey) return 'suanli';
    } else {
      // 普通用户优先使用Gemini
      if (hasGeminiKey) return 'gemini';
      if (hasOpenRouterKey) return 'openrouter';
      if (hasSuanliKey) return 'suanli';
    }
    
    // 如果没有配置任何密钥，使用算力云作为默认
    return 'suanli';
  }

  // 验证聊天请求
  private validateChatRequest(request: ChatRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new BadRequestException('消息不能为空');
    }

    if (request.messages.length > 50) {
      throw new BadRequestException('消息数量不能超过50条');
    }

    for (const message of request.messages) {
      if (!message.role || !message.content) {
        throw new BadRequestException('消息格式不正确');
      }

      if (message.content.length > 10000) {
        throw new BadRequestException('单条消息不能超过10000字符');
      }
    }

    if (request.temperature !== undefined) {
      if (request.temperature < 0 || request.temperature > 2) {
        throw new BadRequestException('temperature必须在0-2之间');
      }
    }

    if (request.max_tokens !== undefined) {
      if (request.max_tokens < 1 || request.max_tokens > 4096) {
        throw new BadRequestException('max_tokens必须在1-4096之间');
      }
    }
  }

  // 记录使用情况
  private async recordUsage(userId: string, userRole: string, usage: unknown): Promise<void> {
    try {
      // 这里应该记录到数据库
      console.log('AI使用记录:', {
        userId,
        userRole,
        usage,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('记录使用情况失败:', error);
    }
  }

  // 获取用户使用统计
  async getUserUsageStats(_userId: string): Promise<{
    today: { requests: number; tokens: number };
    thisMonth: { requests: number; tokens: number };
    total: { requests: number; tokens: number };
  }> {
    // 这里应该从数据库查询
    // 暂时返回模拟数据
    return {
      today: { requests: 10, tokens: 5000 },
      thisMonth: { requests: 150, tokens: 75000 },
      total: { requests: 500, tokens: 250000 },
    };
  }

  // 健康检查
  async healthCheck(): Promise<{
    status: string;
    providers: Record<string, boolean>;
    timestamp: string;
  }> {
    const providers = {
      openrouter: await this.openRouterService.healthCheck(),
      gemini: await this.geminiService.healthCheck(),
      suanli: await this.suanliService.healthCheck(),
    };

    const anyHealthy = Object.values(providers).some(status => status);

    return {
      status: anyHealthy ? 'healthy' : 'degraded',
      providers,
      timestamp: new Date().toISOString(),
    };
  }
} 