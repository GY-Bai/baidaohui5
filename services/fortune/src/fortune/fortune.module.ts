import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FortuneController } from './fortune.controller';
import { FortuneService } from './fortune.service';
import { FortuneGateway } from './fortune.gateway';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb+srv://localhost/baidaohui'),
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema }
    ]),
  ],
  controllers: [FortuneController],
  providers: [FortuneService, FortuneGateway],
  exports: [FortuneService],
})
export class FortuneModule {} 