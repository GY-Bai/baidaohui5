import { Injectable } from '@nestjs/common';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitService {
  private readonly limits: Map<string, RateLimitRecord> = new Map();

  async checkLimit(
    userId: string,
    period: 'minute' | 'hour' | 'day',
    limit: number
  ): Promise<boolean> {
    if (limit === 0) return false; // 不允许使用

    const key = `${userId}:${period}`;
    const now = Date.now();
    const periodMs = this.getPeriodMs(period);
    
    const record = this.limits.get(key);
    
    if (!record || now >= record.resetTime) {
      // 创建新的限制记录
      this.limits.set(key, {
        count: 1,
        resetTime: now + periodMs,
      });
      return true;
    }
    
    if (record.count >= limit) {
      return false; // 超过限制
    }
    
    // 增加计数
    record.count++;
    return true;
  }

  async getRemainingRequests(
    userId: string,
    period: 'minute' | 'hour' | 'day',
    limit: number
  ): Promise<{
    remaining: number;
    resetTime: number;
  }> {
    const key = `${userId}:${period}`;
    const record = this.limits.get(key);
    
    if (!record || Date.now() >= record.resetTime) {
      return {
        remaining: limit,
        resetTime: Date.now() + this.getPeriodMs(period),
      };
    }
    
    return {
      remaining: Math.max(0, limit - record.count),
      resetTime: record.resetTime,
    };
  }

  async resetUserLimits(userId: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const key of this.limits.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.limits.delete(key);
    }
  }

  async getUserLimitStatus(userId: string): Promise<{
    minute: { used: number; limit: number; resetTime: number };
    hour: { used: number; limit: number; resetTime: number };
    day: { used: number; limit: number; resetTime: number };
  }> {
    const periods: Array<'minute' | 'hour' | 'day'> = ['minute', 'hour', 'day'];
    const status: any = {};
    
    for (const period of periods) {
      const key = `${userId}:${period}`;
      const record = this.limits.get(key);
      
      if (!record || Date.now() >= record.resetTime) {
        status[period] = {
          used: 0,
          limit: 0, // 这里应该从配置中获取
          resetTime: Date.now() + this.getPeriodMs(period),
        };
      } else {
        status[period] = {
          used: record.count,
          limit: 0, // 这里应该从配置中获取
          resetTime: record.resetTime,
        };
      }
    }
    
    return status;
  }

  // 清理过期的限制记录
  async cleanup(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, record] of this.limits.entries()) {
      if (now >= record.resetTime) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.limits.delete(key);
    }
    
    console.log(`清理了 ${keysToDelete.length} 个过期的速率限制记录`);
  }

  private getPeriodMs(period: 'minute' | 'hour' | 'day'): number {
    switch (period) {
      case 'minute':
        return 60 * 1000;
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 1000;
    }
  }

  // 获取统计信息
  async getStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalRequests: number;
  }> {
    const users = new Set<string>();
    let totalRequests = 0;
    
    for (const [key, record] of this.limits.entries()) {
      const userId = key.split(':')[0];
      users.add(userId);
      totalRequests += record.count;
    }
    
    return {
      totalUsers: users.size,
      activeUsers: users.size, // 简化处理
      totalRequests,
    };
  }
} 