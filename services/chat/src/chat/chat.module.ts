import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MessageService } from './message.service';
import { ThumbnailService } from './thumbnail.service';

@Module({
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    MessageService,
    ThumbnailService,
  ],
  exports: [ChatService, MessageService],
})
export class ChatModule {} 