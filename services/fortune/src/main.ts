import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { FortuneModule } from './fortune/fortune.module';

async function bootstrap() {
  // 创建gRPC微服务
  const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    FortuneModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'fortune',
        protoPath: join(__dirname, '../proto/fortune.proto'),
        url: '0.0.0.0:50051',
      },
    },
  );

  // 创建HTTP服务用于Webhook和WebSocket
  const httpApp = await NestFactory.create(FortuneModule);
  
  httpApp.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  httpApp.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // 启动服务
  await grpcApp.listen();
  await httpApp.listen(3001);

  console.log('Fortune Service started:');
  console.log('- gRPC server on port 50051');
  console.log('- HTTP server on port 3001');
}

bootstrap(); 