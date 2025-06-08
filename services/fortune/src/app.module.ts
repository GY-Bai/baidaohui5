import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FortuneModule } from './fortune/fortune.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb+srv://localhost/baidaohui'),
    FortuneModule,
    HealthModule,
  ],
})
export class AppModule {} 