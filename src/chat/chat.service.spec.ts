import { PostStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;

  const transaction = {
    chatRoom: {
      create: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
    },
  };
  const prisma = {
    petPost: {
      findUnique: jest.fn(),
    },
    chatRoom: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    chatRoomMember: {
      update: jest.fn(),
    },
    chatMessage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const currentUser = {
    id: '10000000-0000-4000-8000-000000000001',
    firstName: 'Contact',
    lastName: 'User',
    avatarUrl: null,
  };
  const owner = {
    id: '20000000-0000-4000-8000-000000000002',
    firstName: 'Post',
    lastName: 'Owner',
    avatarUrl: 'https://example.com/avatar.png',
  };
  const roomId = '30000000-0000-4000-8000-000000000003';
  const postId = '40000000-0000-4000-8000-000000000004';
  const now = new Date('2026-08-20T10:00:00.000Z');

  const makeMessage = (id = '50000000-0000-4000-8000-000000000005') => ({
    id,
    roomId,
    senderId: owner.id,
    clientMessageId: null,
    content: 'Hello',
    imageUrl: null,
    createdAt: now,
    sender: owner,
  });

  const makeRoom = () => ({
    id: roomId,
    postId,
    createdById: currentUser.id,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    post: {
      id: postId,
      type: 'LOST',
      status: PostStatus.ACTIVE,
      petName: 'Milo',
      petType: 'DOG',
      breed: null,
      province: 'Bangkok',
      district: null,
      createdAt: now,
      images: [{ imageUrl: 'https://example.com/pet.png' }],
    },
    members: [{ user: owner }, { user: currentUser }],
    messages: [makeMessage()],
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChatService);
  });

  describe('createOrGetRoom', () => {
    it('creates the room and both members in one transaction', async () => {
      prisma.petPost.findUnique.mockResolvedValue({
        id: postId,
        userId: owner.id,
        status: PostStatus.ACTIVE,
      });
      prisma.chatRoom.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeRoom());
      transaction.chatRoom.create.mockResolvedValue({ id: roomId });

      const result = await service.createOrGetRoom(currentUser.id, { postId });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.chatRoom.create).toHaveBeenCalledWith({
        data: {
          postId,
          createdById: currentUser.id,
          members: {
            create: [{ userId: owner.id }, { userId: currentUser.id }],
          },
        },
        select: { id: true },
      });
      expect(result.room.id).toBe(roomId);
      expect(result.room.otherMember).toEqual(owner);
    });

    it('returns an existing room without creating another one', async () => {
      prisma.petPost.findUnique.mockResolvedValue({
        id: postId,
        userId: owner.id,
        status: PostStatus.ACTIVE,
      });
      prisma.chatRoom.findUnique
        .mockResolvedValueOnce({ id: roomId })
        .mockResolvedValueOnce(makeRoom());

      const result = await service.createOrGetRoom(currentUser.id, { postId });

      expect(result.room.id).toBe(roomId);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns the concurrent room after a P2002 conflict', async () => {
      prisma.petPost.findUnique.mockResolvedValue({
        id: postId,
        userId: owner.id,
        status: PostStatus.ACTIVE,
      });
      prisma.chatRoom.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: roomId })
        .mockResolvedValueOnce(makeRoom());
      prisma.$transaction.mockRejectedValue({ code: 'P2002' });

      const result = await service.createOrGetRoom(currentUser.id, { postId });

      expect(result.room.id).toBe(roomId);
    });

    it('throws when the post does not exist', async () => {
      prisma.petPost.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrGetRoom(currentUser.id, { postId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the post is not active', async () => {
      prisma.petPost.findUnique.mockResolvedValue({
        id: postId,
        userId: owner.id,
        status: PostStatus.CLOSED,
      });

      await expect(
        service.createOrGetRoom(currentUser.id, { postId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents the post owner from chatting with themselves', async () => {
      prisma.petPost.findUnique.mockResolvedValue({
        id: postId,
        userId: currentUser.id,
        status: PostStatus.ACTIVE,
      });

      await expect(
        service.createOrGetRoom(currentUser.id, { postId }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listRooms', () => {
    it('returns safe room summaries and unread counts', async () => {
      prisma.chatRoom.findMany.mockResolvedValue([makeRoom()]);
      prisma.$queryRaw.mockResolvedValue([{ roomId, unreadCount: 2 }]);

      const result = await service.listRooms(currentUser.id);

      expect(prisma.chatRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            members: { some: { userId: currentUser.id, leftAt: null } },
          },
        }),
      );
      expect(result.rooms[0]).toEqual(
        expect.objectContaining({
          id: roomId,
          otherMember: owner,
          unreadCount: 2,
        }),
      );
      expect(result.rooms[0].post).toEqual(
        expect.objectContaining({
          coverImageUrl: 'https://example.com/pet.png',
        }),
      );
    });

    it('does not query unread counts when there are no rooms', async () => {
      prisma.chatRoom.findMany.mockResolvedValue([]);

      await expect(service.listRooms(currentUser.id)).resolves.toEqual({
        rooms: [],
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('getRoom', () => {
    it('throws NotFoundException when the room does not exist', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue(null);

      await expect(service.getRoom(currentUser.id, roomId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a non-member', async () => {
      const room = makeRoom();
      room.members = [{ user: owner }];
      prisma.chatRoom.findUnique.mockResolvedValue(room);

      await expect(service.getRoom(currentUser.id, roomId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('listMessages', () => {
    it('uses cursor pagination and returns the next cursor', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      const messages = Array.from({ length: 3 }, (_, index) =>
        makeMessage(`50000000-0000-4000-8000-00000000000${index}`),
      );
      prisma.chatMessage.findUnique.mockResolvedValue({
        roomId,
        deletedAt: null,
      });
      prisma.chatMessage.findMany.mockResolvedValue(messages);

      const result = await service.listMessages(currentUser.id, roomId, {
        cursor: '60000000-0000-4000-8000-000000000006',
        limit: 2,
      });

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId, deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 3,
          cursor: { id: '60000000-0000-4000-8000-000000000006' },
          skip: 1,
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe(messages[1].id);
    });

    it('rejects a cursor that does not exist', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.chatMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.listMessages(currentUser.id, roomId, {
          cursor: '60000000-0000-4000-8000-000000000006',
          limit: 30,
        }),
      ).rejects.toThrow(new BadRequestException('Invalid message cursor'));
      expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    });

    it('rejects a cursor that belongs to another room', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.chatMessage.findUnique.mockResolvedValue({
        roomId: '70000000-0000-4000-8000-000000000007',
        deletedAt: null,
      });

      await expect(
        service.listMessages(currentUser.id, roomId, {
          cursor: '60000000-0000-4000-8000-000000000006',
          limit: 30,
        }),
      ).rejects.toThrow(new BadRequestException('Invalid message cursor'));
      expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    });

    it('rejects a user who is not an active member', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({ id: roomId, members: [] });

      await expect(
        service.listMessages(currentUser.id, roomId, { limit: 30 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendMessage', () => {
    it('persists a message and updates lastMessageAt in one transaction', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatMessage.create.mockResolvedValue(message);
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });

      const result = await service.sendMessage(currentUser.id, roomId, {
        content: 'Hello',
        clientMessageId: 'client-1',
      });

      expect(transaction.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            roomId,
            senderId: currentUser.id,
            content: 'Hello',
            clientMessageId: 'client-1',
          },
        }),
      );
      expect(transaction.chatRoom.update).toHaveBeenCalledWith({
        where: { id: roomId },
        data: { lastMessageAt: message.createdAt },
      });
      expect(result).toEqual({ message });
    });

    it('returns the existing message after a duplicate clientMessageId', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.$transaction.mockRejectedValue({ code: 'P2002' });
      prisma.chatMessage.findUnique.mockResolvedValue(message);

      const result = await service.sendMessage(currentUser.id, roomId, {
        content: 'Retried message',
        clientMessageId: 'client-1',
      });

      expect(prisma.chatMessage.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId_senderId_clientMessageId: {
              roomId,
              senderId: currentUser.id,
              clientMessageId: 'client-1',
            },
          },
        }),
      );
      expect(result).toEqual({ message });
    });
  });

  describe('markAsRead', () => {
    it('updates the active member read state', async () => {
      const readState = { roomId, userId: currentUser.id, lastReadAt: now };
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.chatRoomMember.update.mockResolvedValue(readState);

      await expect(service.markAsRead(currentUser.id, roomId)).resolves.toEqual(
        { readState },
      );
      expect(prisma.chatRoomMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId_userId: { roomId, userId: currentUser.id },
          },
        }),
      );
    });
  });

  describe('deleteRoom', () => {
    it('hard deletes a room for either active member', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.chatRoom.delete.mockResolvedValue({ id: roomId });

      await service.deleteRoom(currentUser.id, roomId);

      expect(prisma.chatRoom.delete).toHaveBeenCalledWith({
        where: { id: roomId },
      });
    });
  });
});
