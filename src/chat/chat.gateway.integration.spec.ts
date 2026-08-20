import { UserRole } from '@/database/generated/prisma/enums';
import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import { ForbiddenException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { Server as HttpServer } from 'node:http';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ChatMessagePayload,
  ChatReadUpdatedPayload,
  ChatWebSocketAcknowledgement,
} from './chat-socket.type';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

type ConnectError = Error & {
  data?: unknown;
};

const TEST_TIMEOUT_MS = 5000;
const NO_EVENT_WAIT_MS = 150;

describe('ChatGateway transport integration', () => {
  jest.setTimeout(15000);

  let app: INestApplication | undefined;
  let baseUrl: string;
  let clients: Socket[];

  const userAId = '10000000-0000-4000-8000-000000000001';
  const userBId = '20000000-0000-4000-8000-000000000002';
  const roomId = '30000000-0000-4000-8000-000000000003';
  const secondRoomId = '40000000-0000-4000-8000-000000000004';
  const forbiddenRoomId = '50000000-0000-4000-8000-000000000005';
  const tokenUsers = new Map([
    ['token-user-a', userAId],
    ['token-user-b', userBId],
  ]);
  const allowedRooms = new Map([
    [userAId, new Set([roomId])],
    [userBId, new Set([roomId, secondRoomId])],
  ]);

  const accessTokenService: jest.Mocked<Pick<AccessTokenService, 'verify'>> = {
    verify: jest.fn(),
  };
  const chatService: jest.Mocked<
    Pick<ChatService, 'assertActiveMember' | 'persistMessage' | 'markAsRead'>
  > = {
    assertActiveMember: jest.fn(),
    persistMessage: jest.fn(),
    markAsRead: jest.fn(),
  };

  const createMessage = (
    senderId: string,
    selectedRoomId: string,
    clientMessageId = 'client-message-1',
  ): ChatMessagePayload => ({
    id: '60000000-0000-4000-8000-000000000006',
    roomId: selectedRoomId,
    senderId,
    clientMessageId,
    content: 'Hello from user A',
    imageUrl: null,
    createdAt: new Date('2026-08-20T10:00:00.000Z'),
    sender: {
      id: senderId,
      firstName: 'Chat',
      lastName: 'User',
      avatarUrl: null,
    },
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    clients = [];

    accessTokenService.verify.mockImplementation((token) => {
      const userId = tokenUsers.get(token);

      if (!userId) {
        return Promise.reject(new Error('Invalid token'));
      }

      return Promise.resolve({
        sub: userId,
        email: `${userId}@example.com`,
        role: UserRole.USER,
      });
    });
    chatService.assertActiveMember.mockImplementation(
      (userId, selectedRoomId) => {
        if (allowedRooms.get(userId)?.has(selectedRoomId)) {
          return Promise.resolve();
        }

        return Promise.reject(
          new ForbiddenException('You are not an active member of this room'),
        );
      },
    );
    chatService.persistMessage.mockImplementation(
      (userId, selectedRoomId, dto) =>
        Promise.resolve({
          message: createMessage(userId, selectedRoomId, dto.clientMessageId),
          wasCreated: true,
        }),
    );
    chatService.markAsRead.mockImplementation((userId, selectedRoomId) =>
      Promise.resolve({
        readState: {
          roomId: selectedRoomId,
          userId,
          lastReadAt: new Date('2026-08-20T10:05:00.000Z'),
        },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: AccessTokenService, useValue: accessTokenService },
        { provide: ChatService, useValue: chatService },
      ],
    }).compile();

    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');

    const httpServer = app.getHttpServer() as HttpServer;
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test application did not expose a network address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.removeAllListeners();
      client.disconnect();
    }
    clients = [];

    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('rejects a client without a token with structured connect_error', async () => {
    const error = await connectExpectingError();

    expect(error.data).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Access token is required',
    });
    expect(accessTokenService.verify).not.toHaveBeenCalled();
  });

  it('connects user A and user B with their access tokens', async () => {
    const [userA, userB] = await Promise.all([
      connectClient('token-user-a'),
      connectClient('token-user-b'),
    ]);

    expect(userA.connected).toBe(true);
    expect(userB.connected).toBe(true);
    expect(accessTokenService.verify).toHaveBeenCalledWith('token-user-a');
    expect(accessTokenService.verify).toHaveBeenCalledWith('token-user-b');
  });

  it('lets user A and user B join the same room with acknowledgements', async () => {
    const [userA, userB] = await connectUsers();

    const [ackA, ackB] = await Promise.all([
      emitWithAck<ChatWebSocketAcknowledgement<{ roomId: string }>>(
        userA,
        'join_room',
        { roomId },
      ),
      emitWithAck<ChatWebSocketAcknowledgement<{ roomId: string }>>(
        userB,
        'join_room',
        { roomId },
      ),
    ]);

    expect(ackA).toEqual({ success: true, data: { roomId } });
    expect(ackB).toEqual({ success: true, data: { roomId } });
  });

  it('persists with the token userId, broadcasts to user B, and acknowledges user A', async () => {
    const [userA, userB] = await connectUsers();
    await joinRoom(userA, roomId);
    await joinRoom(userB, roomId);
    const newMessagePromise = waitForEvent<ChatMessagePayload>(
      userB,
      'new_message',
    );

    const acknowledgement = await emitWithAck<
      ChatWebSocketAcknowledgement<{ message: ChatMessagePayload }>
    >(userA, 'send_message', {
      roomId,
      content: 'Hello from user A',
      clientMessageId: 'client-message-1',
    });
    const receivedMessage = await newMessagePromise;

    expect(chatService.persistMessage).toHaveBeenCalledWith(userAId, roomId, {
      content: 'Hello from user A',
      clientMessageId: 'client-message-1',
    });
    expect(receivedMessage.senderId).toBe(userAId);
    expect(acknowledgement).toEqual({
      success: true,
      data: { message: receivedMessage },
    });
  });

  it('acknowledges an idempotent retry without broadcasting new_message again', async () => {
    const [userA, userB] = await connectUsers();
    await joinRoom(userA, roomId);
    await joinRoom(userB, roomId);
    const message = createMessage(userAId, roomId);
    chatService.persistMessage.mockResolvedValue({
      message,
      wasCreated: false,
    });
    const received = jest.fn();
    userB.on('new_message', received);

    const acknowledgement = await emitWithAck<
      ChatWebSocketAcknowledgement<{ message: ChatMessagePayload }>
    >(userA, 'send_message', {
      roomId,
      content: message.content,
      clientMessageId: message.clientMessageId,
    });
    await waitForNoEvent();

    expect(acknowledgement).toEqual({
      success: true,
      data: { message: expect.objectContaining({ id: message.id }) },
    });
    expect(received).not.toHaveBeenCalled();
  });

  it('does not let a non-member join a room', async () => {
    const userB = await connectClient('token-user-b');

    const acknowledgement = await emitWithAck<
      ChatWebSocketAcknowledgement<{ roomId: string }>
    >(userB, 'join_room', { roomId: forbiddenRoomId });

    expect(acknowledgement).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You are not an active member of this room',
      },
    });
  });

  it('does not deliver a message to a client joined to a different room', async () => {
    const [userA, userB] = await connectUsers();
    await joinRoom(userA, roomId);
    await joinRoom(userB, secondRoomId);
    const received = jest.fn();
    userB.on('new_message', received);

    const acknowledgement = await emitWithAck<
      ChatWebSocketAcknowledgement<{ message: ChatMessagePayload }>
    >(userA, 'send_message', {
      roomId,
      content: 'Only room one should receive this',
      clientMessageId: 'room-one-message',
    });
    await waitForNoEvent();

    expect(acknowledgement.success).toBe(true);
    expect(received).not.toHaveBeenCalled();
  });

  it('broadcasts read_updated to clients in the room after mark_read succeeds', async () => {
    const [userA, userB] = await connectUsers();
    await joinRoom(userA, roomId);
    await joinRoom(userB, roomId);
    const readUpdatedPromise = waitForEvent<ChatReadUpdatedPayload>(
      userB,
      'read_updated',
    );

    const acknowledgement = await emitWithAck<
      ChatWebSocketAcknowledgement<ChatReadUpdatedPayload>
    >(userA, 'mark_read', { roomId });
    const readUpdated = await readUpdatedPromise;

    expect(chatService.markAsRead).toHaveBeenCalledWith(userAId, roomId);
    expect(readUpdated).toEqual({
      roomId,
      userId: userAId,
      lastReadAt: '2026-08-20T10:05:00.000Z',
    });
    expect(acknowledgement).toEqual({
      success: true,
      data: readUpdated,
    });
  });

  it('does not broadcast new_message when persistence fails', async () => {
    const [userA, userB] = await connectUsers();
    await joinRoom(userA, roomId);
    await joinRoom(userB, roomId);
    chatService.persistMessage.mockRejectedValue(new Error('database failed'));
    const received = jest.fn();
    userB.on('new_message', received);

    const acknowledgement = await emitWithAck<
      ChatWebSocketAcknowledgement<{ message: ChatMessagePayload }>
    >(userA, 'send_message', {
      roomId,
      content: 'This message must not broadcast',
    });
    await waitForNoEvent();

    expect(acknowledgement).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to process chat event',
      },
    });
    expect(received).not.toHaveBeenCalled();
  });

  async function connectUsers(): Promise<[Socket, Socket]> {
    return Promise.all([
      connectClient('token-user-a'),
      connectClient('token-user-b'),
    ]);
  }

  async function joinRoom(client: Socket, selectedRoomId: string) {
    const acknowledgement = await emitWithAck<
      ChatWebSocketAcknowledgement<{ roomId: string }>
    >(client, 'join_room', { roomId: selectedRoomId });

    if (!acknowledgement.success) {
      throw new Error(
        `Unable to join test room: ${acknowledgement.error.message}`,
      );
    }
  }

  function createClient(token?: string): Socket {
    const client = io(`${baseUrl}/chat`, {
      auth: token ? { token } : {},
      forceNew: true,
      reconnection: false,
      timeout: TEST_TIMEOUT_MS,
      transports: ['websocket'],
    });
    clients.push(client);
    return client;
  }

  function connectClient(token: string): Promise<Socket> {
    const client = createClient(token);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for Socket.IO connection'));
      }, TEST_TIMEOUT_MS);

      client.once('connect', () => {
        clearTimeout(timeout);
        resolve(client);
      });
      client.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  function connectExpectingError(): Promise<ConnectError> {
    const client = createClient();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for Socket.IO connect_error'));
      }, TEST_TIMEOUT_MS);

      client.once('connect', () => {
        clearTimeout(timeout);
        reject(new Error('Socket.IO client connected unexpectedly'));
      });
      client.once('connect_error', (error: ConnectError) => {
        clearTimeout(timeout);
        resolve(error);
      });
    });
  }

  function emitWithAck<T>(
    client: Socket,
    event: string,
    payload: unknown,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${event} acknowledgement`));
      }, TEST_TIMEOUT_MS);

      client.emit(event, payload, (acknowledgement: T) => {
        clearTimeout(timeout);
        resolve(acknowledgement);
      });
    });
  }

  function waitForEvent<T>(client: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${event}`));
      }, TEST_TIMEOUT_MS);

      client.once(event, (payload: T) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });
  }

  function waitForNoEvent(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, NO_EVENT_WAIT_MS);
    });
  }
});
