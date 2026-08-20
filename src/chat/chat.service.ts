import { Prisma } from '@/database/generated/prisma/client';
import { PostStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.requireActiveMember(roomId, userId);

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

    return {
      items,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async sendMessage(userId: string, roomId: string, dto: SendChatMessageDto) {
    await this.requireActiveMember(roomId, userId);

    try {
      const message = await this.prisma.$transaction(async (transaction) => {
        const createdMessage = await transaction.chatMessage.create({
          data: {
            roomId,
            senderId: userId,
            content: dto.content,
            clientMessageId: dto.clientMessageId,
          },
          select: MESSAGE_SELECT,
        });

        await transaction.chatRoom.update({
          where: { id: roomId },
          data: { lastMessageAt: createdMessage.createdAt },
        });

        return createdMessage;
      });

      return { message };
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
          return { message: existingMessage };
        }
      }

      throw error;
    }
  }

  async markAsRead(userId: string, roomId: string) {
    await this.requireActiveMember(roomId, userId);

    const readState = await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: new Date() },
      select: {
        roomId: true,
        userId: true,
        lastReadAt: true,
      },
    });

    return { readState };
  }

  async deleteRoom(userId: string, roomId: string): Promise<void> {
    await this.requireActiveMember(roomId, userId);
    await this.prisma.chatRoom.delete({ where: { id: roomId } });
  }

  private async requireActiveMember(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const room = await this.prisma.chatRoom.findUnique({
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
}
