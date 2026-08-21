import { NotificationsGateway } from '@/notifications/notifications.gateway';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ListNotificationsDto } from '@/notifications/dto/list-notifications.dto';
import { NotificationType } from '@/database/generated/prisma/enums';

@Injectable()
export class NotificationsService {
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

  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedPostId?: string;
    relatedMatchId?: string;
    relatedConversationId?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { notificationEnabled: true },
    });

    if (!user?.notificationEnabled) {
      return null;
    }

    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        isRead: false,
        ...(params.relatedPostId && { relatedPostId: params.relatedPostId }),
        ...(params.relatedMatchId && { relatedMatchId: params.relatedMatchId }),
      },
    });

    if (existing) {
      return existing;
    }

    const notification = await this.prisma.notification.create({
      data: params,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId: params.userId, isRead: false },
    });

    this.gateway.notifyNewNotification(params.userId, notification);
    this.gateway.notifyCountUpdate(params.userId, unreadCount);

    return notification;
  }
}
