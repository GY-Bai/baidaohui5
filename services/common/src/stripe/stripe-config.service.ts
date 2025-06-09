import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

export interface StripeConfig {
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  environment: 'test' | 'live';
}

@Injectable()
export class StripeConfigService {
  private readonly logger = new Logger(StripeConfigService.name);
  private client: MongoClient;
  private db: Db;

  constructor() {
    this.client = new MongoClient(process.env.MONGODB_URI || '');
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.db = this.client.db('baidaohui');
      this.logger.log('MongoDB连接成功');
    } catch (error) {
      this.logger.error('MongoDB连接失败', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async getStripeConfig(sellerId?: string): Promise<StripeConfig> {
    try {
      const collection = this.db.collection('stripe_configs');
      
      // 优先查找商户特定配置，否则使用默认配置
      const config = await collection.findOne({
        $or: [
          { _id: sellerId || 'default' },
          { sellerId: sellerId },
          { _id: 'default' }
        ]
      });

      if (!config) {
        throw new Error(`Stripe配置未找到: ${sellerId || 'default'}`);
      }

      return {
        secretKey: config.secretKey,
        publicKey: config.publicKey,
        webhookSecret: config.webhookSecret,
        environment: config.environment
      };
    } catch (error) {
      this.logger.error(`获取Stripe配置失败: ${sellerId || 'default'}`, error);
      throw error;
    }
  }

  async updateStripeConfig(sellerId: string, config: Partial<StripeConfig>): Promise<void> {
    try {
      const collection = this.db.collection('stripe_configs');
      
      await collection.updateOne(
        { _id: sellerId },
        { 
          $set: { 
            ...config, 
            updatedAt: new Date() 
          } 
        },
        { upsert: true }
      );

      this.logger.log(`Stripe配置更新成功: ${sellerId}`);
    } catch (error) {
      this.logger.error(`更新Stripe配置失败: ${sellerId}`, error);
      throw error;
    }
  }

  async listStripeConfigs(): Promise<unknown[]> {
    try {
      const collection = this.db.collection('stripe_configs');
      return await collection.find({}).toArray();
    } catch (error) {
      this.logger.error('获取Stripe配置列表失败', error);
      throw error;
    }
  }
} 