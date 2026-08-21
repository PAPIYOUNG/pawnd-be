import { NotificationsGateway } from '@/notifications/notifications.gateway';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ListNotificationsDto } from '@/notifications/dto/list-notifications.dto';
import { NotificationType } from '@/database/generated/prisma/enums';
import type { Notification, Prisma } from '@/database/generated/prisma/client';

export type CreateNotificationParams = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedPostId?: string;
  relatedMatchId?: string;
  relatedChatRoomId?: string;
};

export type NotificationPersistenceResult = {
  notification: Notification | null;
  wasCreated: boolean;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async findAll(userId: string, query: ListNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      userId,
      ...(query.isRead !== undefined && { isRead: query.isRead }),
      ...(query.type !== undefined && { type: query.type }),
    };

    const [notifications, unreadCount, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          relatedPostId: true,
          relatedMatchId: true,
          relatedChatRoomId: true,
          isRead: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, unreadCount, meta: { page, limit, total } };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { unreadCount };
  }

  async findOne(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        relatedChatRoomId: true,
        isRead: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return { notification };
  }

  async markAsRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, isRead: true, readAt: true },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    this.gateway.notifyCountUpdate(userId, unreadCount);

    return { notification };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    this.gateway.notifyCountUpdate(userId, 0);

    return { message: 'All notifications marked as read' };
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { message: 'Notification deleted' };
  }

  async create(params: CreateNotificationParams) {
    const result = await this.prisma.$transaction((transaction) =>
      this.createInTransaction(transaction, params),
    );

    try {
      await this.publishCreated(result);
    } catch {
      this.logger.warn('Failed to publish notification event after commit');
    }

    return result.notification;
  }

  /** Internal persistence primitive. The caller owns the transaction and emit timing. */
  async createInTransaction(
    transaction: Prisma.TransactionClient,
    params: CreateNotificationParams,
  ): Promise<NotificationPersistenceResult> {
    const user = await transaction.user.findUnique({
      where: { id: params.userId },
      select: { notificationEnabled: true },
    });

    if (!user?.notificationEnabled) {
      return { notification: null, wasCreated: false };
    }

    const existing = await transaction.notification.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        isRead: false,
        ...(params.relatedPostId && { relatedPostId: params.relatedPostId }),
        ...(params.relatedMatchId && { relatedMatchId: params.relatedMatchId }),
        ...(params.relatedChatRoomId && {
          relatedChatRoomId: params.relatedChatRoomId,
        }),
      },
    });

    if (existing) {
      return { notification: existing, wasCreated: false };
    }

    const notification = await transaction.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        ...(params.relatedPostId !== undefined && {
          relatedPostId: params.relatedPostId,
        }),
        ...(params.relatedMatchId !== undefined && {
          relatedMatchId: params.relatedMatchId,
        }),
        ...(params.relatedChatRoomId !== undefined && {
          relatedChatRoomId: params.relatedChatRoomId,
        }),
      },
    });

    return { notification, wasCreated: true };
  }

  /** Internal post-commit publisher. Never call this from a database transaction. */
  async publishCreated(result: NotificationPersistenceResult): Promise<void> {
    if (!result.wasCreated || !result.notification) {
      return;
    }

    const unreadCount = await this.prisma.notification.count({
      where: { userId: result.notification.userId, isRead: false },
    });

    this.gateway.notifyNewNotification(
      result.notification.userId,
      result.notification,
    );
    this.gateway.notifyCountUpdate(result.notification.userId, unreadCount);
  }
}
