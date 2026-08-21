import { NotificationType } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const transaction = {
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = {
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const gateway = {
    notifyNewNotification: jest.fn(),
    notifyCountUpdate: jest.fn(),
  };

  const userId = '10000000-0000-4000-8000-000000000001';
  const roomId = '20000000-0000-4000-8000-000000000002';
  const now = new Date('2026-08-21T10:00:00.000Z');
  const notification = {
    id: '30000000-0000-4000-8000-000000000003',
    userId,
    type: NotificationType.NEW_MESSAGE,
    title: 'New chat message',
    message: 'You have a new message',
    relatedPostId: null,
    relatedMatchId: null,
    relatedChatRoomId: roomId,
    isRead: false,
    readAt: null,
    createdAt: now,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('returns relatedChatRoomId in notification lists', async () => {
    prisma.notification.findMany.mockResolvedValue([notification]);
    prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const result = await service.findAll(userId, { page: 1, limit: 20 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ relatedChatRoomId: true }),
      }),
    );
    expect(result.notifications[0].relatedChatRoomId).toBe(roomId);
  });

  it('returns relatedChatRoomId for a single notification', async () => {
    prisma.notification.findFirst.mockResolvedValue(notification);

    const result = await service.findOne(userId, notification.id);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ relatedChatRoomId: true }),
      }),
    );
    expect(result.notification.relatedChatRoomId).toBe(roomId);
  });

  it('creates NEW_MESSAGE data explicitly with relatedChatRoomId', async () => {
    transaction.user.findUnique.mockResolvedValue({
      notificationEnabled: true,
    });
    transaction.notification.findFirst.mockResolvedValue(null);
    transaction.notification.create.mockResolvedValue(notification);
    prisma.notification.count.mockResolvedValue(1);

    await expect(
      service.create({
        userId,
        type: NotificationType.NEW_MESSAGE,
        title: notification.title,
        message: notification.message,
        relatedChatRoomId: roomId,
      }),
    ).resolves.toEqual(notification);

    expect(transaction.notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId,
        type: NotificationType.NEW_MESSAGE,
        isRead: false,
        relatedChatRoomId: roomId,
      },
    });
    expect(transaction.notification.create).toHaveBeenCalledWith({
      data: {
        userId,
        type: NotificationType.NEW_MESSAGE,
        title: notification.title,
        message: notification.message,
        relatedChatRoomId: roomId,
      },
    });
  });

  it('returns the existing unread NEW_MESSAGE notification for the same room', async () => {
    transaction.user.findUnique.mockResolvedValue({
      notificationEnabled: true,
    });
    transaction.notification.findFirst.mockResolvedValue(notification);

    await expect(
      service.create({
        userId,
        type: NotificationType.NEW_MESSAGE,
        title: notification.title,
        message: notification.message,
        relatedChatRoomId: roomId,
      }),
    ).resolves.toEqual(notification);

    expect(transaction.notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId,
        type: NotificationType.NEW_MESSAGE,
        isRead: false,
        relatedChatRoomId: roomId,
      },
    });
    expect(transaction.notification.create).not.toHaveBeenCalled();
    expect(gateway.notifyNewNotification).not.toHaveBeenCalled();
  });

  it('does not create a notification when notifications are disabled', async () => {
    transaction.user.findUnique.mockResolvedValue({
      notificationEnabled: false,
    });

    await expect(
      service.create({
        userId,
        type: NotificationType.NEW_MESSAGE,
        title: notification.title,
        message: notification.message,
        relatedChatRoomId: roomId,
      }),
    ).resolves.toBeNull();

    expect(transaction.notification.findFirst).not.toHaveBeenCalled();
    expect(transaction.notification.create).not.toHaveBeenCalled();
  });

  it('does not emit while persisting inside a caller-owned transaction', async () => {
    transaction.user.findUnique.mockResolvedValue({
      notificationEnabled: true,
    });
    transaction.notification.findFirst.mockResolvedValue(null);
    transaction.notification.create.mockResolvedValue(notification);

    await expect(
      service.createInTransaction(transaction, {
        userId,
        type: NotificationType.NEW_MESSAGE,
        title: notification.title,
        message: notification.message,
        relatedChatRoomId: roomId,
      }),
    ).resolves.toEqual({ notification, wasCreated: true });

    expect(gateway.notifyNewNotification).not.toHaveBeenCalled();
    expect(gateway.notifyCountUpdate).not.toHaveBeenCalled();
    expect(prisma.notification.count).not.toHaveBeenCalled();
  });

  it('publishes only after the public create transaction commits', async () => {
    const callOrder: string[] = [];
    transaction.user.findUnique.mockResolvedValue({
      notificationEnabled: true,
    });
    transaction.notification.findFirst.mockResolvedValue(null);
    transaction.notification.create.mockImplementation(() => {
      callOrder.push('persisted');
      return Promise.resolve(notification);
    });
    prisma.$transaction.mockImplementation(async (callback) => {
      const result = await callback(transaction);
      callOrder.push('committed');
      return result as unknown;
    });
    prisma.notification.count.mockResolvedValue(1);
    gateway.notifyNewNotification.mockImplementation(() => {
      callOrder.push('published');
    });

    await service.create({
      userId,
      type: NotificationType.NEW_MESSAGE,
      title: notification.title,
      message: notification.message,
      relatedChatRoomId: roomId,
    });

    expect(callOrder).toEqual(['persisted', 'committed', 'published']);
  });

  it.each(['unread count query', 'Socket.IO emit'])(
    'returns the persisted notification when post-commit %s fails',
    async (failurePoint) => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      transaction.user.findUnique.mockResolvedValue({
        notificationEnabled: true,
      });
      transaction.notification.findFirst.mockResolvedValue(null);
      transaction.notification.create.mockResolvedValue(notification);

      if (failurePoint === 'unread count query') {
        prisma.notification.count.mockRejectedValue(
          new Error('count unavailable'),
        );
      } else {
        prisma.notification.count.mockResolvedValue(1);
        gateway.notifyNewNotification.mockImplementation(() => {
          throw new Error('socket unavailable');
        });
      }

      await expect(
        service.create({
          userId,
          type: NotificationType.NEW_MESSAGE,
          title: notification.title,
          message: 'Sensitive notification content',
          relatedChatRoomId: roomId,
        }),
      ).resolves.toEqual(notification);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.notification.create).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to publish notification event after commit',
      );
      expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain(
        'Sensitive notification content',
      );
      loggerSpy.mockRestore();
    },
  );
});
