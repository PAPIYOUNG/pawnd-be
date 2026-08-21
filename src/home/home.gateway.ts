import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { HomeService } from './home.service';

export interface NewPostAlertPayload {
  id: string;
  type: string;
  petName: string;
  petType: string;
  province: string;
  coverImageUrl?: string | null;
  createdAt: Date;
}

export interface ReunitedAlertPayload {
  id: string;
  petName: string;
  petType: string;
  province: string;
  reunitedAt: Date;
  coverImageUrl?: string | null;
}

@WebSocketGateway({
  namespace: '/home',
})
export class HomeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HomeGateway.name);

  constructor(private readonly homeService: HomeService) {}

  afterInit() {
    this.logger.log('Home WebSocket Gateway initialized on namespace /home');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected to /home WebSocket: ${client.id}`);
    try {
      const statsResult = await this.homeService.getSummaryStats();
      client.emit('stats_update', statsResult.stats);
    } catch (err) {
      this.logger.error('Failed to send initial stats on connection', err);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /home WebSocket: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(client: Socket) {
    const statsResult = await this.homeService.getSummaryStats();
    client.emit('stats_update', statsResult.stats);
    return { event: 'subscribed', data: statsResult.stats };
  }

  /**
   * Broadcast real-time stats update to all connected clients
   */
  async broadcastStatsUpdate(): Promise<void> {
    try {
      const statsResult = await this.homeService.getSummaryStats();
      if (this.server) {
        this.server.emit('stats_update', statsResult.stats);
      }
    } catch (err) {
      this.logger.error('Error broadcasting stats update', err);
    }
  }

  /**
   * Broadcast new lost/found post notification to all connected clients
   */
  broadcastNewPostAlert(payload: NewPostAlertPayload): void {
    if (this.server) {
      this.server.emit('new_post_alert', payload);
    }
  }

  /**
   * Broadcast reunited pet celebration alert to all connected clients
   */
  broadcastReunitedAlert(payload: ReunitedAlertPayload): void {
    if (this.server) {
      this.server.emit('reunited_alert', payload);
    }
  }
}
