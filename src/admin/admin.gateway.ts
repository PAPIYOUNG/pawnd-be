import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/admin',
  cors: {
    origin: '*',
  },
})
export class AdminGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminGateway.name);

  afterInit() {
    this.logger.log('Admin WebSocket Gateway initialized on namespace /admin');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to /admin WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /admin WebSocket: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket) {
    client.join('admins');

    return {
      event: 'subscribed',
      data: {
        room: 'admins',
      },
    };
  }

  broadcastReportCreated(payload: unknown): void {
    this.server.to('admins').emit('report_created', payload);
  }

  broadcastUserStatusUpdated(payload: unknown): void {
    this.server.to('admins').emit('user_status_updated', payload);
  }

  broadcastPostStatusUpdated(payload: unknown): void {
    this.server.to('admins').emit('post_status_updated', payload);
  }

  broadcastDashboardStats(payload: unknown): void {
    this.server.to('admins').emit('dashboard_stats_updated', payload);
  }

  broadcastCommunityPostUpdated(payload: unknown): void {
    this.server.to('admins').emit('community_post_updated', payload);
  }

  broadcastCommunityPostDeleted(payload: unknown): void {
    this.server.to('admins').emit('community_post_deleted', payload);
  }
}
