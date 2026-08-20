import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import type { ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import type {
  AuthenticatedChatSocket,
  ChatMessagePayload,
  ChatReadUpdatedPayload,
  ChatSocketServer,
  ChatWebSocketAcknowledgement,
  ChatWebSocketError,
} from './chat-socket.type';
import { ChatService } from './chat.service';
import {
  ChatRoomEventDto,
  SendChatMessageEventDto,
} from './dto/chat-socket-event.dto';

class ChatEventError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type SocketAuthenticationError = Error & {
  data: ChatWebSocketError;
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server: ChatSocketServer;

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(server: ChatSocketServer): void {
    server.use((socket, next) => {
      void this.authenticateSocket(socket)
        .then(() => next())
        .catch((error: unknown) => {
          next(this.toAuthenticationError(error));
        });
    });
  }

  @SubscribeMessage('join_room')
  async joinRoom(
    @ConnectedSocket() socket: AuthenticatedChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<ChatWebSocketAcknowledgement<{ roomId: string }>> {
    return this.handleEvent(async () => {
      const dto = await this.validatePayload(ChatRoomEventDto, payload);
      const userId = this.getUserId(socket);

      await this.chatService.assertActiveMember(userId, dto.roomId);
      await socket.join(this.toSocketRoom(dto.roomId));

      return { roomId: dto.roomId };
    });
  }

  @SubscribeMessage('leave_room')
  async leaveRoom(
    @ConnectedSocket() socket: AuthenticatedChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<ChatWebSocketAcknowledgement<{ roomId: string }>> {
    return this.handleEvent(async () => {
      const dto = await this.validatePayload(ChatRoomEventDto, payload);
      const userId = this.getUserId(socket);

      await this.chatService.assertActiveMember(userId, dto.roomId);
      await socket.leave(this.toSocketRoom(dto.roomId));

      return { roomId: dto.roomId };
    });
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() socket: AuthenticatedChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<ChatWebSocketAcknowledgement<{ message: ChatMessagePayload }>> {
    return this.handleEvent(async () => {
      const dto = await this.validatePayload(SendChatMessageEventDto, payload);
      const userId = this.getUserId(socket);
      const { roomId, ...messageDto } = dto;
      const result = await this.chatService.persistMessage(
        userId,
        roomId,
        messageDto,
      );

      if (result.wasCreated) {
        this.server
          .to(this.toSocketRoom(roomId))
          .emit('new_message', result.message);
      }

      return { message: result.message };
    });
  }

  @SubscribeMessage('mark_read')
  async markRead(
    @ConnectedSocket() socket: AuthenticatedChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<ChatWebSocketAcknowledgement<ChatReadUpdatedPayload>> {
    return this.handleEvent(async () => {
      const dto = await this.validatePayload(ChatRoomEventDto, payload);
      const userId = this.getUserId(socket);
      const { readState } = await this.chatService.markAsRead(
        userId,
        dto.roomId,
      );

      if (!readState.lastReadAt) {
        throw new Error('Read state update did not return a timestamp');
      }

      const readUpdated: ChatReadUpdatedPayload = {
        roomId: readState.roomId,
        userId: readState.userId,
        lastReadAt: readState.lastReadAt.toISOString(),
      };

      this.server
        .to(this.toSocketRoom(dto.roomId))
        .emit('read_updated', readUpdated);

      return readUpdated;
    });
  }

  private async authenticateSocket(
    socket: AuthenticatedChatSocket,
  ): Promise<void> {
    const token = socket.handshake.auth?.token;

    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new ChatEventError('UNAUTHORIZED', 'Access token is required');
    }

    try {
      const payload = await this.accessTokenService.verify(token);

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new Error('Access token subject is missing');
      }

      socket.data.userId = payload.sub;
    } catch {
      throw new ChatEventError(
        'UNAUTHORIZED',
        'Invalid or expired access token',
      );
    }
  }

  private async validatePayload<T extends object>(
    dtoClass: ClassConstructor<T>,
    payload: unknown,
  ): Promise<T> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new ChatEventError('VALIDATION_ERROR', 'Invalid event payload');
    }

    const dto = plainToInstance(dtoClass, payload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new ChatEventError('VALIDATION_ERROR', 'Invalid event payload');
    }

    return dto;
  }

  private getUserId(socket: AuthenticatedChatSocket): string {
    const userId = socket.data?.userId;

    if (typeof userId !== 'string' || userId.length === 0) {
      throw new ChatEventError('UNAUTHORIZED', 'Socket is not authenticated');
    }

    return userId;
  }

  private async handleEvent<T>(
    operation: () => Promise<T>,
  ): Promise<ChatWebSocketAcknowledgement<T>> {
    try {
      return { success: true, data: await operation() };
    } catch (error: unknown) {
      return { success: false, error: this.toWebSocketError(error) };
    }
  }

  private toWebSocketError(error: unknown): ChatWebSocketError {
    if (error instanceof ChatEventError) {
      return { code: error.code, message: error.message };
    }

    if (error instanceof HttpException) {
      const codeByStatus: Partial<Record<HttpStatus, string>> = {
        [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
        [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
        [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
        [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
        [HttpStatus.CONFLICT]: 'CONFLICT',
      };

      return {
        code: codeByStatus[error.getStatus()] ?? 'REQUEST_FAILED',
        message: error.message,
      };
    }

    return {
      code: 'INTERNAL_ERROR',
      message: 'Unable to process chat event',
    };
  }

  private toAuthenticationError(error: unknown): SocketAuthenticationError {
    const details = this.toWebSocketError(error);
    const authenticationError = new Error(
      details.message,
    ) as SocketAuthenticationError;
    authenticationError.data = details;
    return authenticationError;
  }

  private toSocketRoom(roomId: string): string {
    return `chat-room:${roomId}`;
  }
}
