import { Prisma } from '@/database/generated/prisma/client';
import {
  NotificationType,
  PetType,
  PostStatus,
  PostType,
  UserStatus,
} from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import type { EnvVariableType } from '@/config/env.validate';
import { NotificationsGateway } from '@/notifications/notifications.gateway';
import { NotificationsService } from '@/notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ChatService } from './chat.service';

const RUN_DATABASE_INTEGRATION = process.env.RUN_DB_INTEGRATION === '1';
const describeDatabase = RUN_DATABASE_INTEGRATION ? describe : describe.skip;

type FixtureIds = {
  users: Set<string>;
  posts: Set<string>;
  rooms: Set<string>;
  members: Set<string>;
  messages: Set<string>;
  notifications: Set<string>;
};

describeDatabase('ChatService PostgreSQL integration', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaService | undefined;
  let prismaReady = false;
  let chatService: ChatService;
  let notificationsService: NotificationsService;
  let fixtureIds: FixtureIds = createEmptyFixtureIds();

  const notificationGateway = {
    notifyNewNotification: jest.fn(),
    notifyCountUpdate: jest.fn(),
  };
  const cloudinaryService = {
    uploadChatImage: jest.fn(),
    deleteChatImage: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const databaseUrl = getGuardedLocalDatabaseUrl();
    const configService = new ConfigService({ DATABASE_URL: databaseUrl });

    prisma = new PrismaService(
      configService as ConfigService<EnvVariableType, true>,
    );
    await prisma.$connect();
    prismaReady = true;

    notificationsService = new NotificationsService(
      prisma,
      notificationGateway as unknown as NotificationsGateway,
    );
    chatService = new ChatService(
      prisma,
      notificationsService,
      cloudinaryService as unknown as CloudinaryService,
    );
  });

  beforeEach(() => {
    fixtureIds = createEmptyFixtureIds();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (!prisma || !prismaReady) {
      return;
    }

    try {
      await cleanupFixtureState(prisma, fixtureIds);
    } finally {
      fixtureIds = createEmptyFixtureIds();
    }
  });

  afterAll(async () => {
    const client = prisma;
    try {
      if (client && prismaReady) {
        await cleanupFixtureState(client, fixtureIds);
      }
    } finally {
      prismaReady = false;
      if (client) {
        try {
          await client.$disconnect();
        } catch {
          warnCleanupFailure();
        }
      }
    }
  });

  it('verifies chat persistence, atomicity, idempotency, and room cascades', async () => {
    const database = requirePrisma(prisma);
    const userAId = randomUUID();
    const userBId = randomUUID();
    const postId = randomUUID();
    const emailSuffix = randomUUID();
    const clientMessageId = `chat-db-${randomUUID()}`;
    const rolledBackClientMessageId = `chat-db-${randomUUID()}`;

    await database.user.createMany({
      data: [
        {
          id: userAId,
          firstName: 'Chat DB',
          lastName: 'Owner',
          email: `chat-db-owner-${emailSuffix}@example.invalid`,
          status: UserStatus.ACTIVE,
          notificationEnabled: true,
        },
        {
          id: userBId,
          firstName: 'Chat DB',
          lastName: 'Contact',
          email: `chat-db-contact-${emailSuffix}@example.invalid`,
          status: UserStatus.ACTIVE,
          notificationEnabled: true,
        },
      ],
    });
    fixtureIds.users.add(userAId);
    fixtureIds.users.add(userBId);

    await database.petPost.create({
      data: {
        id: postId,
        userId: userAId,
        type: PostType.LOST,
        status: PostStatus.ACTIVE,
        petName: 'Integration Fixture',
        petType: PetType.DOG,
        eventDate: new Date(),
        latitude: new Prisma.Decimal('13.7563000'),
        longitude: new Prisma.Decimal('100.5018000'),
      },
    });
    fixtureIds.posts.add(postId);

    const createdRoom = await chatService.createOrGetRoom(userBId, { postId });
    const roomId = createdRoom.room.id;
    fixtureIds.rooms.add(roomId);

    const members = await database.chatRoomMember.findMany({
      where: { roomId },
      orderBy: { userId: 'asc' },
      select: { id: true, userId: true },
    });
    members.forEach(({ id }) => fixtureIds.members.add(id));

    expect(members).toHaveLength(2);
    expect(members.map(({ userId }) => userId).sort()).toEqual(
      [userAId, userBId].sort(),
    );

    const firstResult = await chatService.persistMessage(userBId, roomId, {
      content: 'Database integration fixture message',
      clientMessageId,
    });
    fixtureIds.messages.add(firstResult.message.id);

    const persistedMessage = await database.chatMessage.findUniqueOrThrow({
      where: { id: firstResult.message.id },
    });
    const roomAfterMessage = await database.chatRoom.findUniqueOrThrow({
      where: { id: roomId },
      select: { lastMessageAt: true },
    });
    const notifications = await database.notification.findMany({
      where: {
        userId: userAId,
        type: NotificationType.NEW_MESSAGE,
        isRead: false,
        relatedChatRoomId: roomId,
      },
    });
    notifications.forEach(({ id }) => fixtureIds.notifications.add(id));

    expect(firstResult.wasCreated).toBe(true);
    expect(persistedMessage.senderId).toBe(userBId);
    expect(roomAfterMessage.lastMessageAt?.getTime()).toBe(
      persistedMessage.createdAt.getTime(),
    );
    expect(notifications).toHaveLength(1);

    const unreadMessages = await chatService.listMessages(userBId, roomId, {
      limit: 30,
    });
    expect(unreadMessages.items).toEqual([
      expect.objectContaining({ id: persistedMessage.id, isRead: false }),
    ]);

    const readResult = await chatService.markAsRead(userAId, roomId);
    expect(readResult.lastReadMessageId).toBe(persistedMessage.id);
    const readMessages = await chatService.listMessages(userBId, roomId, {
      limit: 30,
    });
    expect(readMessages.items).toEqual([
      expect.objectContaining({ id: persistedMessage.id, isRead: true }),
    ]);

    const retryResult = await chatService.persistMessage(userBId, roomId, {
      content: 'Database integration fixture retry',
      clientMessageId,
    });

    expect(retryResult).toEqual(
      expect.objectContaining({
        message: expect.objectContaining({ id: persistedMessage.id }),
        wasCreated: false,
      }),
    );
    await expect(
      database.chatMessage.count({
        where: { roomId, senderId: userBId, clientMessageId },
      }),
    ).resolves.toBe(1);
    await expect(
      database.notification.count({
        where: {
          userId: userAId,
          type: NotificationType.NEW_MESSAGE,
          isRead: false,
          relatedChatRoomId: roomId,
        },
      }),
    ).resolves.toBe(1);

    const notificationPersistenceSpy = jest
      .spyOn(notificationsService, 'createInTransaction')
      .mockRejectedValueOnce(
        new Error('Forced notification persistence failure'),
      );

    try {
      await expect(
        chatService.persistMessage(userBId, roomId, {
          content: 'Database integration rollback fixture',
          clientMessageId: rolledBackClientMessageId,
        }),
      ).rejects.toThrow('Forced notification persistence failure');
    } finally {
      notificationPersistenceSpy.mockRestore();
    }

    await expect(
      database.chatMessage.count({
        where: {
          roomId,
          senderId: userBId,
          clientMessageId: rolledBackClientMessageId,
        },
      }),
    ).resolves.toBe(0);
    await expect(
      database.chatRoom.findUniqueOrThrow({
        where: { id: roomId },
        select: { lastMessageAt: true },
      }),
    ).resolves.toEqual({ lastMessageAt: roomAfterMessage.lastMessageAt });

    await chatService.deleteRoom(userBId, roomId);

    await expect(
      database.chatRoom.count({ where: { id: roomId } }),
    ).resolves.toBe(0);
    await expect(
      database.chatRoomMember.count({ where: { roomId } }),
    ).resolves.toBe(0);
    await expect(
      database.chatMessage.count({ where: { roomId } }),
    ).resolves.toBe(0);
    await expect(
      database.notification.count({ where: { relatedChatRoomId: roomId } }),
    ).resolves.toBe(0);
  });
});

function getGuardedLocalDatabaseUrl(): string {
  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    throw new Error('Local database integration requires DATABASE_URL');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error('Local database integration requires a valid DATABASE_URL');
  }

  if (
    parsedDatabaseUrl.protocol !== 'postgresql:' &&
    parsedDatabaseUrl.protocol !== 'postgres:'
  ) {
    throw new Error('Database integration tests require a PostgreSQL URL');
  }

  if (
    parsedDatabaseUrl.hostname !== 'localhost' &&
    parsedDatabaseUrl.hostname !== '127.0.0.1'
  ) {
    throw new Error(
      'Database integration tests require a localhost PostgreSQL hostname',
    );
  }

  return rawDatabaseUrl;
}

function createEmptyFixtureIds(): FixtureIds {
  return {
    users: new Set(),
    posts: new Set(),
    rooms: new Set(),
    members: new Set(),
    messages: new Set(),
    notifications: new Set(),
  };
}

function requirePrisma(prisma: PrismaService | undefined): PrismaService {
  if (!prisma) {
    throw new Error('Database integration client is not initialized');
  }

  return prisma;
}

async function discoverFixtureIds(
  prisma: PrismaService,
  fixtureIds: FixtureIds,
): Promise<void> {
  const postIds = [...fixtureIds.posts];
  const knownRoomIds = [...fixtureIds.rooms];
  if (postIds.length === 0 && knownRoomIds.length === 0) {
    return;
  }

  const rooms = await prisma.chatRoom.findMany({
    where: {
      OR: [
        ...(knownRoomIds.length > 0 ? [{ id: { in: knownRoomIds } }] : []),
        ...(postIds.length > 0 ? [{ postId: { in: postIds } }] : []),
      ],
    },
    select: { id: true },
  });
  rooms.forEach(({ id }) => fixtureIds.rooms.add(id));

  const roomIds = [...fixtureIds.rooms];
  if (roomIds.length === 0) {
    return;
  }

  const [members, messages, notifications] = await Promise.all([
    prisma.chatRoomMember.findMany({
      where: { roomId: { in: roomIds } },
      select: { id: true },
    }),
    prisma.chatMessage.findMany({
      where: { roomId: { in: roomIds } },
      select: { id: true },
    }),
    prisma.notification.findMany({
      where: { relatedChatRoomId: { in: roomIds } },
      select: { id: true },
    }),
  ]);

  members.forEach(({ id }) => fixtureIds.members.add(id));
  messages.forEach(({ id }) => fixtureIds.messages.add(id));
  notifications.forEach(({ id }) => fixtureIds.notifications.add(id));
}

async function cleanupFixtureState(
  prisma: PrismaService,
  fixtureIds: FixtureIds,
): Promise<void> {
  try {
    await discoverFixtureIds(prisma, fixtureIds);
  } catch {
    warnCleanupFailure();
  }

  try {
    await cleanupExactFixtures(prisma, fixtureIds);
  } catch {
    warnCleanupFailure();
  }
}

async function cleanupExactFixtures(
  prisma: PrismaService,
  fixtureIds: FixtureIds,
): Promise<void> {
  const cleanupErrors: unknown[] = [];
  const runCleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error: unknown) {
      cleanupErrors.push(error);
    }
  };

  await deleteTrackedIds(fixtureIds.notifications, (ids) =>
    runCleanup(() =>
      prisma.notification.deleteMany({ where: { id: { in: ids } } }),
    ),
  );
  await deleteTrackedIds(fixtureIds.messages, (ids) =>
    runCleanup(() =>
      prisma.chatMessage.deleteMany({ where: { id: { in: ids } } }),
    ),
  );
  await deleteTrackedIds(fixtureIds.members, (ids) =>
    runCleanup(() =>
      prisma.chatRoomMember.deleteMany({ where: { id: { in: ids } } }),
    ),
  );
  await deleteTrackedIds(fixtureIds.rooms, (ids) =>
    runCleanup(() =>
      prisma.chatRoom.deleteMany({ where: { id: { in: ids } } }),
    ),
  );
  await deleteTrackedIds(fixtureIds.posts, (ids) =>
    runCleanup(() => prisma.petPost.deleteMany({ where: { id: { in: ids } } })),
  );
  await deleteTrackedIds(fixtureIds.users, (ids) =>
    runCleanup(() => prisma.user.deleteMany({ where: { id: { in: ids } } })),
  );

  if (cleanupErrors.length > 0) {
    warnCleanupFailure();
  }
}

function warnCleanupFailure(): void {
  process.emitWarning('Chat integration fixture cleanup encountered an error');
}

async function deleteTrackedIds(
  ids: Set<string>,
  operation: (ids: string[]) => Promise<void>,
): Promise<void> {
  if (ids.size === 0) {
    return;
  }

  await operation([...ids]);
}
