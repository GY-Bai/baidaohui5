import { Injectable, HttpException } from '@nestjs/common';
import { ChatRequest, ChatResponse } from '../ai-proxy.service';

@Injectable()
export class SuanliService {
  private readonly apiKey = process.env.SUANLI_API_KEY;
  private readonly baseUrl = process.env.SUANLI_API_URL || 'https://api.suanli.cn/v1';
  private readonly defaultModel = process.env.SUANLI_DEFAULT_MODEL || 'free:QwQ-32B';

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new HttpException(`算力云API错误: ${response.statusText}`, response.status);
      }

      const data = await response.json();
      return data as ChatResponse;
    } catch (error) {
      console.error('算力云请求失败:', error);
      throw new HttpException('算力云服务不可用', 503);
    }
  }

  async *chatStream(request: ChatRequest): AsyncIterable<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new HttpException(`算力云API错误: ${response.statusText}`, response.status);
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
      console.error('算力云流式请求失败:', error);
      throw new HttpException('算力云流式服务不可用', 503);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 发送一个简单的测试请求
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('算力云健康检查失败:', error);
      return false;
    }
  }

  // 检查算力云服务是否可用
  isAvailable(): boolean {
    return !!(this.apiKey && this.baseUrl);
  }
} 