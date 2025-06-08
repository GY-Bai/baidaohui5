import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });
  
  // 全局前缀
  app.setGlobalPrefix('api');
  
  const port = process.env.PORT || 3003;
  await app.listen(port);
  
  console.log(`AI Proxy service is running on port ${port}`);
}

bootstrap(); 