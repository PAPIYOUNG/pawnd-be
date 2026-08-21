import { UserRole } from '@/database/generated/prisma/enums';
import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthenticatedChatSocket,
  ChatSocketServer,
  ChatWebSocketAcknowledgement,
} from './chat-socket.type';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

type SocketMiddleware = (
  socket: AuthenticatedChatSocket,
  next: (error?: Error & { data?: unknown }) => void,
) => void;

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let registeredMiddleware: SocketMiddleware | undefined;

  const roomId = '30000000-0000-4000-8000-000000000003';
  const secondRoomId = '40000000-0000-4000-8000-000000000004';
  const userId = '10000000-0000-4000-8000-000000000001';
  const accessTokenService = {
    verify: jest.fn(),
  };
  const chatService = {
    assertActiveMember: jest.fn(),
    persistMessage: jest.fn(),
    markAsRead: jest.fn(),
  };
  const roomBroadcaster = {
    emit: jest.fn(),
  };
  const server = {
    use: jest.fn<(middleware: SocketMiddleware) => void>(),
    to: jest.fn(() => roomBroadcaster),
  };

  const createSocket = (
    token: string | null = 'valid-token',
  ): AuthenticatedChatSocket =>
    ({
      handshake: { auth: token === null ? {} : { token } },
      data: {},
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    }) as unknown as AuthenticatedChatSocket;

  const getSocketRoomMocks = (socket: AuthenticatedChatSocket) =>
    socket as unknown as { join: jest.Mock; leave: jest.Mock };

  const authenticate = async (
    socket: AuthenticatedChatSocket,
  ): Promise<(Error & { data?: unknown }) | undefined> => {
    gateway.afterInit(server as unknown as ChatSocketServer);

    if (!registeredMiddleware) {
      throw new Error('Socket middleware was not registered');
    }

    const middleware = registeredMiddleware;
    return new Promise((resolve) => middleware(socket, resolve));
  };

  beforeEach(() => {
    jest.resetAllMocks();
    registeredMiddleware = undefined;
    server.use.mockImplementation((middleware) => {
      registeredMiddleware = middleware;
    });
    server.to.mockReturnValue(roomBroadcaster);
    gateway = new ChatGateway(
      accessTokenService as unknown as AccessTokenService,
      chatService as unknown as ChatService,
    );
    gateway.server = server as unknown as ChatSocketServer;
  });

  describe('authentication middleware', () => {
    it('accepts a valid token and stores its subject in socket data', async () => {
      const socket = createSocket();
      accessTokenService.verify.mockResolvedValue({
        sub: userId,
        email: 'user@example.com',
        role: UserRole.USER,
      });

      await expect(authenticate(socket)).resolves.toBeUndefined();
      expect(accessTokenService.verify).toHaveBeenCalledWith('valid-token');
      expect(socket.data.userId).toBe(userId);
    });

    it('rejects a missing token', async () => {
      const socket = createSocket(null);

      const error = await authenticate(socket);

      expect(error?.data).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Access token is required',
      });
      expect(accessTokenService.verify).not.toHaveBeenCalled();
    });

    it('rejects an invalid or expired token without logging it', async () => {
      const token = 'sensitive-invalid-token';
      const socket = createSocket(token);
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      accessTokenService.verify.mockRejectedValue(new Error('expired'));

      const error = await authenticate(socket);

      expect(error?.data).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token',
      });
      expect(JSON.stringify(error)).not.toContain(token);
      expect(loggerSpy).not.toHaveBeenCalled();
      loggerSpy.mockRestore();
    });

    it('rejects an inactive account without assigning socket identity', async () => {
      const socket = createSocket();
      accessTokenService.verify.mockRejectedValue(
        new UnauthorizedException('Account is not active'),
      );

      const error = await authenticate(socket);

      expect(error?.data).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token',
      });
      expect(socket.data.userId).toBeUndefined();
    });
  });

  describe('room membership', () => {
    it('joins an active member to a namespaced Socket.IO room', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      chatService.assertActiveMember.mockResolvedValue(undefined);

      const acknowledgement = await gateway.joinRoom(socket, { roomId });

      expect(chatService.assertActiveMember).toHaveBeenCalledWith(
        userId,
        roomId,
      );
      expect(getSocketRoomMocks(socket).join).toHaveBeenCalledWith(
        `chat-room:${roomId}`,
      );
      expect(acknowledgement).toEqual({
        success: true,
        data: { roomId },
      });
    });

    it('does not join a user who is not an active member', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      chatService.assertActiveMember.mockRejectedValue(
        new ForbiddenException('Not a member'),
      );

      const acknowledgement = await gateway.joinRoom(socket, { roomId });

      expect(getSocketRoomMocks(socket).join).not.toHaveBeenCalled();
      expect(acknowledgement).toEqual({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member' },
      });
    });

    it('isolates Socket.IO rooms by roomId', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      chatService.assertActiveMember.mockResolvedValue(undefined);

      await gateway.joinRoom(socket, { roomId });
      await gateway.joinRoom(socket, { roomId: secondRoomId });

      expect(getSocketRoomMocks(socket).join).toHaveBeenNthCalledWith(
        1,
        `chat-room:${roomId}`,
      );
      expect(getSocketRoomMocks(socket).join).toHaveBeenNthCalledWith(
        2,
        `chat-room:${secondRoomId}`,
      );
    });

    it('leaves only the Socket.IO room without changing membership state', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      chatService.assertActiveMember.mockResolvedValue(undefined);

      const acknowledgement = await gateway.leaveRoom(socket, { roomId });

      expect(getSocketRoomMocks(socket).leave).toHaveBeenCalledWith(
        `chat-room:${roomId}`,
      );
      expect(acknowledgement).toEqual({
        success: true,
        data: { roomId },
      });
    });
  });

  describe('send_message', () => {
    const message = {
      id: '50000000-0000-4000-8000-000000000005',
      roomId,
      senderId: userId,
      content: 'Hello',
      clientMessageId: 'client-1',
      imageUrl: null,
      createdAt: new Date('2026-08-20T10:00:00.000Z'),
    };

    it('uses the socket userId and broadcasts only after persistence succeeds', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      let resolvePersistence: (value: {
        message: typeof message;
        wasCreated: boolean;
      }) => void = () => undefined;
      chatService.persistMessage.mockReturnValue(
        new Promise((resolve) => {
          resolvePersistence = resolve;
        }),
      );

      const pendingAcknowledgement = gateway.sendMessage(socket, {
        roomId,
        content: '  Hello  ',
        clientMessageId: 'client-1',
      });
      await Promise.resolve();

      expect(roomBroadcaster.emit).not.toHaveBeenCalled();
      resolvePersistence({ message, wasCreated: true });
      const acknowledgement = await pendingAcknowledgement;

      expect(chatService.persistMessage).toHaveBeenCalledWith(userId, roomId, {
        content: 'Hello',
        clientMessageId: 'client-1',
      });
      expect(server.to).toHaveBeenCalledWith(`chat-room:${roomId}`);
      expect(roomBroadcaster.emit).toHaveBeenCalledWith('new_message', message);
      expect(acknowledgement).toEqual({
        success: true,
        data: { message },
      });
    });

    it('does not broadcast when persistence fails', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      chatService.persistMessage.mockRejectedValue(new Error('database down'));

      const acknowledgement = await gateway.sendMessage(socket, {
        roomId,
        content: 'Hello',
      });

      expect(server.to).not.toHaveBeenCalled();
      expect(roomBroadcaster.emit).not.toHaveBeenCalled();
      expect(acknowledgement).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to process chat event',
        },
      });
    });

    it('acknowledges an idempotent retry without broadcasting again', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      chatService.persistMessage.mockResolvedValue({
        message,
        wasCreated: false,
      });

      const acknowledgement = await gateway.sendMessage(socket, {
        roomId,
        content: 'Hello',
        clientMessageId: 'client-1',
      });

      expect(roomBroadcaster.emit).not.toHaveBeenCalled();
      expect(acknowledgement).toEqual({
        success: true,
        data: { message },
      });
    });

    it('rejects whitespace-only content before calling persistence', async () => {
      const socket = createSocket();
      socket.data.userId = userId;

      const acknowledgement = await gateway.sendMessage(socket, {
        roomId,
        content: '   ',
      });

      expect(chatService.persistMessage).not.toHaveBeenCalled();
      expect(acknowledgement).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event payload',
        },
      });
    });
  });

  describe('mark_read', () => {
    it('broadcasts read_updated only after the database update succeeds', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      const lastReadAt = new Date('2026-08-20T10:05:00.000Z');
      let resolveRead: (value: {
        readState: { roomId: string; userId: string; lastReadAt: Date };
      }) => void = () => undefined;
      chatService.markAsRead.mockReturnValue(
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
      );

      const pendingAcknowledgement = gateway.markRead(socket, { roomId });
      await Promise.resolve();

      expect(roomBroadcaster.emit).not.toHaveBeenCalled();
      resolveRead({ readState: { roomId, userId, lastReadAt } });
      const acknowledgement = await pendingAcknowledgement;
      const expectedPayload = {
        roomId,
        userId,
        lastReadAt: lastReadAt.toISOString(),
      };

      expect(chatService.markAsRead).toHaveBeenCalledWith(userId, roomId);
      expect(roomBroadcaster.emit).toHaveBeenCalledWith(
        'read_updated',
        expectedPayload,
      );
      expect(acknowledgement).toEqual({
        success: true,
        data: expectedPayload,
      });
    });

    it('does not broadcast read state for a non-member', async () => {
      const socket = createSocket();
      socket.data.userId = userId;
      chatService.markAsRead.mockRejectedValue(
        new ForbiddenException('Not a member'),
      );

      const acknowledgement = await gateway.markRead(socket, { roomId });

      expect(roomBroadcaster.emit).not.toHaveBeenCalled();
      expect(acknowledgement).toEqual({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member' },
      });
    });
  });

  it('returns a structured validation error for an invalid roomId', async () => {
    const socket = createSocket();
    socket.data.userId = userId;

    const acknowledgement: ChatWebSocketAcknowledgement<{ roomId: string }> =
      await gateway.joinRoom(socket, { roomId: 'invalid' });

    expect(acknowledgement).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid event payload',
      },
    });
    expect(chatService.assertActiveMember).not.toHaveBeenCalled();
  });
});
