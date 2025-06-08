import { Injectable, HttpException } from '@nestjs/common';
import { ChatRequest, ChatResponse } from '../ai-proxy.service';

@Injectable()
export class OpenRouterService {
  private readonly apiKey = process.env.OPENROUTER_API_KEY;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://baidaohui.com',
          'X-Title': '百刀会 AI助手',
        },
        body: JSON.stringify({
          model: request.model || 'openai/gpt-4o-mini',
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new HttpException(`OpenRouter API错误: ${response.statusText}`, response.status);
      }

      const data = await response.json();
      return data as ChatResponse;
    } catch (error) {
      console.error('OpenRouter请求失败:', error);
      throw new HttpException('OpenRouter服务不可用', 503);
    }
  }

  async *chatStream(request: ChatRequest): AsyncIterable<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://baidaohui.com',
          'X-Title': '百刀会 AI助手',
        },
        body: JSON.stringify({
          model: request.model || 'openai/gpt-4o-mini',
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new HttpException(`OpenRouter API错误: ${response.statusText}`, response.status);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new HttpException('无法读取响应流', 500);
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  yield content;
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('OpenRouter流式请求失败:', error);
      throw new HttpException('OpenRouter流式服务不可用', 503);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('OpenRouter健康检查失败:', error);
      return false;
    }
  }
} 