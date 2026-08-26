import { Prisma } from '@/database/generated/prisma/client';
import {
  NotificationType,
  PostStatus,
} from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import {
  NotificationPersistenceResult,
  NotificationsService,
} from '@/notifications/notifications.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ChatMessageQueryDto,
  DEFAULT_CHAT_MESSAGE_LIMIT,
} from './dto/chat-message-query.dto';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

const SAFE_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const POST_SUMMARY_SELECT = {
  id: true,
  type: true,
  status: true,
  petName: true,
  petType: true,
  breed: true,
  province: true,
  district: true,
  createdAt: true,
  images: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { imageUrl: true },
  },
} satisfies Prisma.PetPostSelect;

const MESSAGE_SELECT = {
  id: true,
  roomId: true,
  senderId: true,
  clientMessageId: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  sender: { select: SAFE_USER_SELECT },
} satisfies Prisma.ChatMessageSelect;

const ROOM_RESPONSE_SELECT = {
  id: true,
  postId: true,
  createdById: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
  post: { select: POST_SUMMARY_SELECT },
  members: {
    where: { leftAt: null },
    select: { user: { select: SAFE_USER_SELECT } },
  },
  messages: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: MESSAGE_SELECT,
  },
} satisfies Prisma.ChatRoomSelect;

type RoomRecord = Prisma.ChatRoomGetPayload<{
  select: typeof ROOM_RESPONSE_SELECT;
}>;

type UnreadCountRow = {
  roomId: string;
  unreadCount: number | bigint | string;
};

type ReadMessageIdRow = {
  id: string;
};

type ChatImageAttachment = {
  messageId: string;
  imageUrl: string;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createOrGetRoom(userId: string, dto: CreateChatRoomDto) {
    const post = await this.prisma.petPost.findUnique({
      where: { id: dto.postId },
      select: { id: true, userId: true, status: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status !== PostStatus.ACTIVE) {
      throw new BadRequestException('Post is not active');
    }

    if (post.userId === userId) {
      throw new BadRequestException(
        'Post owners cannot create a chat room for their own post',
      );
    }

    const existingRoom = await this.findRoomByPostAndCreator(
      dto.postId,
      userId,
    );

    if (existingRoom) {
      return this.getRoom(userId, existingRoom.id);
    }

    try {
      const room = await this.prisma.$transaction(async (transaction) =>
        transaction.chatRoom.create({
          data: {
            postId: dto.postId,
            createdById: userId,
            members: {
              create: [{ userId: post.userId }, { userId }],
            },
          },
          select: { id: true },
        }),
      );

      return this.getRoom(userId, room.id);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        const concurrentRoom = await this.findRoomByPostAndCreator(
          dto.postId,
          userId,
        );

        if (concurrentRoom) {
          return this.getRoom(userId, concurrentRoom.id);
        }
      }

      throw error;
    }
  }

  async listRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        members: {
          some: { userId, leftAt: null },
        },
      },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      select: ROOM_RESPONSE_SELECT,
    });

    if (rooms.length === 0) {
      return { rooms: [] };
    }

    const unreadRows = await this.prisma.$queryRaw<UnreadCountRow[]>(Prisma.sql`
      SELECT
        crm.room_id AS "roomId",
        COUNT(cm.id)::int AS "unreadCount"
      FROM chat_room_members AS crm
      LEFT JOIN chat_messages AS cm
        ON cm.room_id = crm.room_id
        AND cm.deleted_at IS NULL
        AND cm.sender_id <> ${userId}::uuid
        AND (
          crm.last_read_at IS NULL
          OR cm.created_at > crm.last_read_at
        )
      WHERE crm.user_id = ${userId}::uuid
        AND crm.left_at IS NULL
      GROUP BY crm.room_id
    `);
    const unreadByRoomId = new Map(
      unreadRows.map((row) => [row.roomId, Number(row.unreadCount)]),
    );

    return {
      rooms: rooms.map((room) =>
        this.toRoomResponse(room, userId, unreadByRoomId.get(room.id) ?? 0),
      ),
    };
  }

  async getRoom(userId: string, roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: ROOM_RESPONSE_SELECT,
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    if (!room.members.some((member) => member.user.id === userId)) {
      throw new ForbiddenException('You are not an active member of this room');
    }

    return { room: this.toRoomResponse(room, userId) };
  }

  async listMessages(
    userId: string,
    roomId: string,
    query: ChatMessageQueryDto,
  ) {
    await this.assertActiveMember(userId, roomId);

    if (query.cursor) {
      const cursorMessage = await this.prisma.chatMessage.findUnique({
        where: { id: query.cursor },
        select: { roomId: true, deletedAt: true },
      });

      if (
        !cursorMessage ||
        cursorMessage.roomId !== roomId ||
        cursorMessage.deletedAt !== null
      ) {
        throw new BadRequestException('Invalid message cursor');
      }
    }

    const limit = query.limit ?? DEFAULT_CHAT_MESSAGE_LIMIT;
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      select: MESSAGE_SELECT,
    });
    const hasNextPage = messages.length > limit;
    const items = hasNextPage ? messages.slice(0, limit) : messages;
    const readMessageIds = await this.findReadOwnMessageIds(
      userId,
      roomId,
      items,
    );

    return {
      items: items.map((message) => ({
        ...message,
        isRead: readMessageIds.has(message.id),
      })),
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    };
  }

  /** รับข้อความ REST และดูแลรูปที่อัปโหลดไม่ให้ตกค้างเมื่อ persist ไม่สำเร็จ */
  async sendMessage(
    userId: string,
    roomId: string,
    dto: SendChatMessageDto,
    image?: Express.Multer.File,
  ) {
    const content = dto.content?.trim() ?? '';
    if (!content && !image) {
      throw new BadRequestException('Message content or image is required');
    }

    await this.assertActiveMember(userId, roomId);

    let attachment: ChatImageAttachment | undefined;
    if (image) {
      this.assertValidChatImage(image);
      const messageId = randomUUID();
      const imageUrl = await this.cloudinaryService.uploadChatImage(
        image,
        messageId,
      );
      attachment = { messageId, imageUrl };
    }

    try {
      const result = await this.persistMessage(
        userId,
        roomId,
        { ...dto, content },
        attachment,
      );

      if (attachment && !result.wasCreated) {
        await this.cleanupUncommittedChatImage(attachment.messageId);
      }

      return result;
    } catch (error: unknown) {
      if (attachment) {
        await this.cleanupUncommittedChatImage(attachment.messageId);
      }
      throw error;
    }
  }

  async persistMessage(
    userId: string,
    roomId: string,
    dto: SendChatMessageDto,
    attachment?: ChatImageAttachment,
  ) {
    await this.assertActiveMember(userId, roomId);

    const content = dto.content?.trim() ?? '';
    if (!content && !attachment) {
      throw new BadRequestException('Message content or image is required');
    }

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const createdMessage = await transaction.chatMessage.create({
          data: {
            ...(attachment
              ? {
                  id: attachment.messageId,
                  imageUrl: attachment.imageUrl,
                }
              : {}),
            roomId,
            senderId: userId,
            content,
            clientMessageId: dto.clientMessageId,
          },
          select: MESSAGE_SELECT,
        });

        await transaction.chatRoom.update({
          where: { id: roomId },
          data: { lastMessageAt: createdMessage.createdAt },
        });

        const notifications = await this.persistNotificationsForRoom(
          transaction,
          userId,
          roomId,
        );

        return { message: createdMessage, notifications };
      });

      await this.publishNotifications(result.notifications);

      return { message: result.message, wasCreated: true };
    } catch (error: unknown) {
      if (dto.clientMessageId && this.isUniqueConstraintError(error)) {
        const existingMessage = await this.prisma.chatMessage.findUnique({
          where: {
            roomId_senderId_clientMessageId: {
              roomId,
              senderId: userId,
              clientMessageId: dto.clientMessageId,
            },
          },
          select: MESSAGE_SELECT,
        });

        if (existingMessage) {
          const notifications = await this.prisma.$transaction((transaction) =>
            this.persistNotificationsForRoom(transaction, userId, roomId),
          );

          await this.publishNotifications(notifications);

          return { message: existingMessage, wasCreated: false };
        }
      }

      throw error;
    }
  }

  async markAsRead(userId: string, roomId: string) {
    await this.assertActiveMember(userId, roomId);

    // ส่ง message ID เป็น boundary ให้ client แทนการเทียบ timestamp ที่เสีย precision ใน JavaScript
    const lastReadMessage = await this.prisma.chatMessage.findFirst({
      where: {
        roomId,
        senderId: { not: userId },
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });

    const readState = await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: new Date() },
      select: {
        roomId: true,
        userId: true,
        lastReadAt: true,
      },
    });

    return {
      readState,
      lastReadMessageId: lastReadMessage?.id ?? null,
    };
  }

  async deleteRoom(userId: string, roomId: string): Promise<void> {
    // ตรวจสิทธิ์ก่อนอ่านรายการ asset และลบรูปก่อน hard delete เพื่อไม่ทิ้ง orphan บน Cloudinary
    await this.assertActiveMember(userId, roomId);
    const imageMessages = await this.prisma.chatMessage.findMany({
      where: { roomId, imageUrl: { not: null } },
      select: { id: true },
    });
    await Promise.all(
      imageMessages.map(({ id }) => this.cloudinaryService.deleteChatImage(id)),
    );

    try {
      await this.prisma.$transaction(async (transaction) => {
        await this.assertActiveMemberWithClient(transaction, userId, roomId);
        await transaction.chatRoom.delete({ where: { id: roomId } });
      });
    } catch (error: unknown) {
      if (this.isRecordNotFoundError(error)) {
        throw new NotFoundException('Chat room not found');
      }

      throw error;
    }
  }

  /** ลบรูปของห้องที่จะถูก hard delete ใน flow ลบบัญชีก่อนเริ่ม transaction */
  async deleteImageAssetsForUserRooms(userId: string): Promise<void> {
    const imageMessages = await this.prisma.chatMessage.findMany({
      where: {
        imageUrl: { not: null },
        room: { members: { some: { userId } } },
      },
      select: { id: true },
    });
    await Promise.all(
      imageMessages.map(({ id }) => this.cloudinaryService.deleteChatImage(id)),
    );
  }

  deleteRoomsForUser(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<Prisma.BatchPayload> {
    return transaction.chatRoom.deleteMany({
      where: { members: { some: { userId } } },
    });
  }

  async assertActiveMember(userId: string, roomId: string): Promise<void> {
    return this.assertActiveMemberWithClient(this.prisma, userId, roomId);
  }

  private async assertActiveMemberWithClient(
    client: Pick<Prisma.TransactionClient, 'chatRoom'>,
    userId: string,
    roomId: string,
  ): Promise<void> {
    const room = await client.chatRoom.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        members: {
          where: { userId, leftAt: null },
          select: { id: true },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    if (room.members.length === 0) {
      throw new ForbiddenException('You are not an active member of this room');
    }
  }

  private findRoomByPostAndCreator(postId: string, createdById: string) {
    return this.prisma.chatRoom.findUnique({
      where: {
        postId_createdById: { postId, createdById },
      },
      select: { id: true },
    });
  }

  private async persistNotificationsForRoom(
    transaction: Prisma.TransactionClient,
    senderId: string,
    roomId: string,
  ): Promise<NotificationPersistenceResult[]> {
    const recipients = await transaction.chatRoomMember.findMany({
      where: {
        roomId,
        leftAt: null,
        userId: { not: senderId },
      },
      select: { userId: true },
    });

    return Promise.all(
      recipients.map(({ userId }) =>
        this.notificationsService.createInTransaction(transaction, {
          userId,
          type: NotificationType.NEW_MESSAGE,
          title: 'New chat message',
          message: 'You have a new message',
          relatedChatRoomId: roomId,
        }),
      ),
    );
  }

  /** ให้ PostgreSQL เทียบเวลาอ่านกับเวลา message โดยตรงเพื่อรักษา microsecond precision */
  private async findReadOwnMessageIds(
    userId: string,
    roomId: string,
    messages: Array<{ id: string; senderId: string }>,
  ): Promise<Set<string>> {
    const ownMessageIds = messages
      .filter((message) => message.senderId === userId)
      .map((message) => message.id);
    if (ownMessageIds.length === 0) return new Set();

    const rows = await this.prisma.$queryRaw<ReadMessageIdRow[]>(Prisma.sql`
      SELECT own_message.id
      FROM chat_messages AS own_message
      WHERE own_message.room_id = ${roomId}::uuid
        AND own_message.sender_id = ${userId}::uuid
        AND own_message.id IN (${Prisma.join(
          ownMessageIds.map((id) => Prisma.sql`${id}::uuid`),
        )})
        AND EXISTS (
          SELECT 1
          FROM chat_room_members AS reader
          WHERE reader.room_id = own_message.room_id
            AND reader.user_id <> ${userId}::uuid
            AND reader.left_at IS NULL
            AND reader.last_read_at IS NOT NULL
            AND own_message.created_at <= reader.last_read_at
        )
    `);

    return new Set(rows.map(({ id }) => id));
  }

  private async publishNotifications(
    notifications: NotificationPersistenceResult[],
  ): Promise<void> {
    const results = await Promise.allSettled(
      notifications.map((notification) =>
        this.notificationsService.publishCreated(notification),
      ),
    );

    const failedCount = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failedCount > 0) {
      this.logger.warn(
        `Failed to publish ${failedCount} chat notification event(s) after commit`,
      );
    }
  }

  /** ตรวจ signature ของไฟล์จริงเพิ่มเติมจาก MIME ที่ client ส่งมา */
  private assertValidChatImage(image: Express.Multer.File): void {
    const buffer = image.buffer;
    const isJpeg =
      image.mimetype === 'image/jpeg' &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isPng =
      image.mimetype === 'image/png' &&
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp =
      image.mimetype === 'image/webp' &&
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException('Chat image content is invalid');
    }
  }

  /** Cleanup เฉพาะรูปใหม่ที่ยังไม่ได้ผูกกับข้อความที่ commit สำเร็จ */
  private async cleanupUncommittedChatImage(messageId: string): Promise<void> {
    try {
      await this.cloudinaryService.deleteChatImage(messageId);
    } catch {
      this.logger.warn(
        `Failed to clean up chat image for message ${messageId}`,
      );
    }
  }

  private toRoomResponse(
    room: RoomRecord,
    userId: string,
    unreadCount?: number,
  ) {
    const { images, ...post } = room.post;

    return {
      id: room.id,
      postId: room.postId,
      createdById: room.createdById,
      lastMessageAt: room.lastMessageAt,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      post: {
        ...post,
        coverImageUrl: images[0]?.imageUrl ?? null,
      },
      otherMember:
        room.members.find((member) => member.user.id !== userId)?.user ?? null,
      latestMessage: room.messages[0] ?? null,
      ...(unreadCount === undefined ? {} : { unreadCount }),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2002';
    }

    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private isRecordNotFoundError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2025';
    }

    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2025'
    );
  }
}
