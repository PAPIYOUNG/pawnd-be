import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';

type AuthenticatedNotificationSocket = Omit<Socket, 'data'> & {
  data: { userId?: string };
};

@WebSocketGateway({
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly accessTokenService: AccessTokenService) {}

  async handleConnection(client: AuthenticatedNotificationSocket) {
    const token = client.handshake.query.token as string;

    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token`);
      client.disconnect();
      return;
    }

    try {
      const payload = await this.accessTokenService.verify(token);
      client.data.userId = payload.sub;
      void client.join(payload.sub);
      this.logger.log(`User ${payload.sub} connected via ${client.id}`);
    } catch {
      this.logger.warn(`Client ${client.id} sent an invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: AuthenticatedNotificationSocket) {
    return { event: 'subscribed', data: { userId: client.data.userId } };
  }

  notifyNewNotification(userId: string, payload: unknown): void {
    this.server.to(userId).emit('new_notification', payload);
  }

  notifyCountUpdate(userId: string, unreadCount: number): void {
    this.server.to(userId).emit('notification_count_update', { unreadCount });
  }
}
