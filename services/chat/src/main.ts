import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用WebSocket适配器
  app.useWebSocketAdapter(new WsAdapter(app));
  
  // 启用CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });
  
  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  console.log(`Chat service is running on port ${port}`);
}

bootstrap(); 