import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FortuneService } from './fortune.service';

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/fortune',
})
export class FortuneGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly fortuneService: FortuneService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // 订阅实时排名
  @SubscribeMessage('subscribe-rank')
  async handleSubscribeRank(
    @MessageBody() data: { amount: number; is_urgent: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const rank = await this.fortuneService.getOrderRank(data.amount, data.is_urgent);
      
      // 发送当前排名
      client.emit('rank-update', { rank });

      // 将客户端加入特定房间，用于后续推送
      const roomName = `rank-${data.amount}-${data.is_urgent}`;
      client.join(roomName);

      return { success: true, rank };
    } catch (error) {
      console.error('Error getting rank:', error);
      client.emit('rank-error', { error: 'Failed to get rank' });
      return { success: false, error: 'Failed to get rank' };
    }
  }

  // 取消订阅排名
  @SubscribeMessage('unsubscribe-rank')
  handleUnsubscribeRank(@ConnectedSocket() client: Socket) {
    // 离开所有排名相关的房间
    const rooms = Array.from(client.rooms);
    rooms.forEach(room => {
      if (room.startsWith('rank-')) {
        client.leave(room);
      }
    });

    return { success: true };
  }

  // 广播排名更新（当有新订单或状态变化时调用）
  async broadcastRankUpdates() {
    // 这个方法会在订单状态变化时被调用
    // 重新计算所有活跃连接的排名
    const rooms = this.server.sockets.adapter.rooms;
    
    for (const [roomName] of rooms) {
      if (roomName.startsWith('rank-')) {
        const [, amount, isUrgent] = roomName.split('-');
        const rank = await this.fortuneService.getOrderRank(
          parseFloat(amount),
          isUrgent === 'true'
        );
        
        this.server.to(roomName).emit('rank-update', { rank });
      }
    }
  }
} 