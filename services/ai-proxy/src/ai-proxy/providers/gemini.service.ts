import { Injectable, HttpException } from '@nestjs/common';
import { ChatRequest, ChatResponse, ChatMessage } from '../ai-proxy.service';

@Injectable()
export class GeminiService {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const model = request.model || 'gemini-1.5-flash';
      const geminiMessages = this.convertToGeminiFormat(request.messages);

      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiMessages,
            generationConfig: {
              temperature: request.temperature || 0.7,
              maxOutputTokens: request.max_tokens || 1000,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new HttpException(`Gemini API错误: ${response.statusText}`, response.status);
      }

      const data = await response.json();
      return this.convertToOpenAIFormat(data, model);
    } catch (error) {
      console.error('Gemini请求失败:', error);
      throw new HttpException('Gemini服务不可用', 503);
    }
  }

  async *chatStream(request: ChatRequest): AsyncIterable<string> {
    try {
      const model = request.model || 'gemini-1.5-flash';
      const geminiMessages = this.convertToGeminiFormat(request.messages);

      const response = await fetch(
        `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiMessages,
            generationConfig: {
              temperature: request.temperature || 0.7,
              maxOutputTokens: request.max_tokens || 1000,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new HttpException(`Gemini API错误: ${response.statusText}`, response.status);
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
            if (line.trim()) {
              try {
                const parsed: unknown = JSON.parse(line);
                const content = (parsed as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } )?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                  yield content;
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Gemini流式请求失败:', error);
      throw new HttpException('Gemini流式服务不可用', 503);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        {
          method: 'GET',
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Gemini健康检查失败:', error);
      return false;
    }
  }

  // 转换OpenAI格式消息到Gemini格式
  private convertToGeminiFormat(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    const geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini没有system角色，将其转换为user消息
        geminiMessages.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }],
        });
      } else if (message.role === 'user') {
        geminiMessages.push({
          role: 'user',
          parts: [{ text: message.content }],
        });
      } else if (message.role === 'assistant') {
        geminiMessages.push({
          role: 'model',
          parts: [{ text: message.content }],
        });
      }
    }

    return geminiMessages;
  }

  // 转换Gemini响应到OpenAI格式
  private convertToOpenAIFormat(geminiResponse: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }, model: string): ChatResponse {
    const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = geminiResponse.candidates?.[0]?.finishReason || 'stop';

    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: finishReason.toLowerCase(),
        },
      ],
      usage: {
        prompt_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
        completion_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: geminiResponse.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
} 