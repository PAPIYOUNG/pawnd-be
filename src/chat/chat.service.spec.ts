import { PostStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { NotificationsService } from '@/notifications/notifications.service';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;

  const transaction = {
    chatRoom: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
    },
    chatRoomMember: {
      findMany: jest.fn(),
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
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const notificationsService = {
    createInTransaction: jest.fn(),
    publishCreated: jest.fn(),
  };
  const cloudinaryService = {
    uploadChatImage:
      jest.fn<
        (file: Express.Multer.File, messageId: string) => Promise<string>
      >(),
    deleteChatImage: jest.fn<(messageId: string) => Promise<void>>(),
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

  const makePngFile = (): Express.Multer.File =>
    ({
      buffer: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]),
      mimetype: 'image/png',
      size: 9,
      originalname: 'chat.png',
    }) as Express.Multer.File;

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
    transaction.chatRoomMember.findMany.mockResolvedValue([]);
    notificationsService.createInTransaction.mockResolvedValue({
      notification: null,
      wasCreated: false,
    });
    notificationsService.publishCreated.mockResolvedValue(undefined);
    cloudinaryService.uploadChatImage.mockResolvedValue(
      'https://example.com/chat-image.webp',
    );
    cloudinaryService.deleteChatImage.mockResolvedValue(undefined);
    prisma.chatMessage.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: CloudinaryService, useValue: cloudinaryService },
      ],
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
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

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
      expect(result.items.every((message) => message.isRead === false)).toBe(
        true,
      );
      expect(result.nextCursor).toBe(messages[1].id);
    });

    it('marks only message ids that PostgreSQL reports as read', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      const ownReadMessage = {
        ...makeMessage('50000000-0000-4000-8000-000000000011'),
        senderId: currentUser.id,
      };
      const ownUnreadMessage = {
        ...makeMessage('50000000-0000-4000-8000-000000000012'),
        senderId: currentUser.id,
      };
      const incomingMessage = makeMessage(
        '50000000-0000-4000-8000-000000000013',
      );
      prisma.chatMessage.findMany.mockResolvedValue([
        ownUnreadMessage,
        ownReadMessage,
        incomingMessage,
      ]);
      prisma.$queryRaw.mockResolvedValue([{ id: ownReadMessage.id }]);

      const result = await service.listMessages(currentUser.id, roomId, {
        limit: 30,
      });

      expect(result.items).toEqual([
        { ...ownUnreadMessage, isRead: false },
        { ...ownReadMessage, isRead: true },
        { ...incomingMessage, isRead: false },
      ]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
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
      expect(result).toEqual({ message, wasCreated: true });
    });

    it('marks a newly persisted message for realtime broadcast', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatMessage.create.mockResolvedValue(message);
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });

      await expect(
        service.persistMessage(currentUser.id, roomId, {
          content: 'Hello',
          clientMessageId: 'client-1',
        }),
      ).resolves.toEqual({ message, wasCreated: true });
    });

    it('returns the existing message after a duplicate clientMessageId', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
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
      expect(result).toEqual({ message, wasCreated: false });
    });

    it('uploads and persists an image-only message with a deterministic asset id', async () => {
      const image = makePngFile();
      const imageUrl = 'https://example.com/chat-image.webp';
      let uploadedMessageId: string | undefined;
      const message = { ...makeMessage(), content: '', imageUrl };
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      cloudinaryService.uploadChatImage.mockImplementationOnce(
        (_file, messageId) => {
          uploadedMessageId = messageId;
          return Promise.resolve(imageUrl);
        },
      );
      transaction.chatMessage.create.mockResolvedValue(message);
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });

      await expect(
        service.sendMessage(
          currentUser.id,
          roomId,
          { clientMessageId: 'image-client-1' },
          image,
        ),
      ).resolves.toEqual({ message, wasCreated: true });

      expect(uploadedMessageId).toEqual(expect.any(String));
      expect(cloudinaryService.uploadChatImage).toHaveBeenCalledWith(
        image,
        expect.any(String),
      );
      expect(transaction.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            id: uploadedMessageId,
            roomId,
            senderId: currentUser.id,
            content: '',
            imageUrl,
            clientMessageId: 'image-client-1',
          },
        }),
      );
      expect(cloudinaryService.deleteChatImage).not.toHaveBeenCalled();
    });

    it('rejects a message with neither text nor an image', async () => {
      await expect(
        service.sendMessage(currentUser.id, roomId, {}),
      ).rejects.toThrow(
        new BadRequestException('Message content or image is required'),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(cloudinaryService.uploadChatImage).not.toHaveBeenCalled();
    });

    it('rejects an image whose bytes do not match its MIME type', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      const fakeImage = {
        ...makePngFile(),
        buffer: Buffer.from('not-a-real-png'),
      };

      await expect(
        service.sendMessage(currentUser.id, roomId, {}, fakeImage),
      ).rejects.toThrow(
        new BadRequestException('Chat image content is invalid'),
      );
      expect(cloudinaryService.uploadChatImage).not.toHaveBeenCalled();
    });

    it('deletes a newly uploaded image when message persistence fails', async () => {
      const image = makePngFile();
      let uploadedMessageId: string | undefined;
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      cloudinaryService.uploadChatImage.mockImplementationOnce(
        (_file, messageId) => {
          uploadedMessageId = messageId;
          return Promise.resolve('https://example.com/chat-image.webp');
        },
      );
      prisma.$transaction.mockRejectedValueOnce(new Error('database failed'));

      await expect(
        service.sendMessage(currentUser.id, roomId, {}, image),
      ).rejects.toThrow('database failed');

      expect(uploadedMessageId).toEqual(expect.any(String));
      expect(cloudinaryService.deleteChatImage).toHaveBeenCalledWith(
        uploadedMessageId,
      );
    });

    it('deletes the redundant uploaded image on an idempotent retry', async () => {
      const image = makePngFile();
      let uploadedMessageId: string | undefined;
      const existingMessage = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      cloudinaryService.uploadChatImage.mockImplementationOnce(
        (_file, messageId) => {
          uploadedMessageId = messageId;
          return Promise.resolve('https://example.com/chat-image.webp');
        },
      );
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
      prisma.chatMessage.findUnique.mockResolvedValue(existingMessage);

      await expect(
        service.sendMessage(
          currentUser.id,
          roomId,
          { clientMessageId: 'client-1' },
          image,
        ),
      ).resolves.toEqual({ message: existingMessage, wasCreated: false });

      expect(uploadedMessageId).toEqual(expect.any(String));
      expect(cloudinaryService.deleteChatImage).toHaveBeenCalledWith(
        uploadedMessageId,
      );
    });

    it('exposes duplicate status to shared realtime persistence callers', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
      prisma.chatMessage.findUnique.mockResolvedValue(message);

      await expect(
        service.persistMessage(currentUser.id, roomId, {
          content: 'Retried message',
          clientMessageId: 'client-1',
        }),
      ).resolves.toEqual({ message, wasCreated: false });
    });

    it('notifies active room members other than the sender', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatMessage.create.mockResolvedValue(message);
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });
      transaction.chatRoomMember.findMany.mockResolvedValue([
        { userId: owner.id },
      ]);
      const notificationResult = {
        notification: { id: 'notification-id', userId: owner.id },
        wasCreated: true,
      };
      notificationsService.createInTransaction.mockResolvedValue(
        notificationResult,
      );

      await service.persistMessage(currentUser.id, roomId, {
        content: 'Hello',
        clientMessageId: 'client-1',
      });

      expect(transaction.chatRoomMember.findMany).toHaveBeenCalledWith({
        where: {
          roomId,
          leftAt: null,
          userId: { not: currentUser.id },
        },
        select: { userId: true },
      });
      expect(notificationsService.createInTransaction).toHaveBeenCalledWith(
        transaction,
        {
          userId: owner.id,
          type: 'NEW_MESSAGE',
          title: 'New chat message',
          message: 'You have a new message',
          relatedChatRoomId: roomId,
        },
      );
      expect(notificationsService.publishCreated).toHaveBeenCalledWith(
        notificationResult,
      );
    });

    it('does not notify the sender or members who have left the room', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatMessage.create.mockResolvedValue(message);
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });
      transaction.chatRoomMember.findMany.mockResolvedValue([]);

      await service.persistMessage(currentUser.id, roomId, {
        content: 'Hello',
      });

      expect(transaction.chatRoomMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId,
            leftAt: null,
            userId: { not: currentUser.id },
          },
        }),
      );
      expect(notificationsService.createInTransaction).not.toHaveBeenCalled();
      expect(notificationsService.publishCreated).not.toHaveBeenCalled();
    });

    it('rolls back the message transaction when notification persistence fails', async () => {
      const message = makeMessage();
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatMessage.create.mockResolvedValue(message);
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });
      transaction.chatRoomMember.findMany.mockResolvedValue([
        { userId: owner.id },
      ]);
      notificationsService.createInTransaction.mockRejectedValue(
        new Error('notification failed'),
      );

      await expect(
        service.persistMessage(currentUser.id, roomId, {
          content: 'Hello',
          clientMessageId: 'client-1',
        }),
      ).rejects.toThrow('notification failed');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.chatMessage.create).toHaveBeenCalledTimes(1);
      expect(transaction.chatRoom.update).toHaveBeenCalledTimes(1);
      expect(notificationsService.publishCreated).not.toHaveBeenCalled();
    });

    it('publishes a created notification only after the message transaction commits', async () => {
      const message = makeMessage();
      const notificationResult = {
        notification: { id: 'notification-id', userId: owner.id },
        wasCreated: true,
      };
      const callOrder: string[] = [];
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatMessage.create.mockImplementation(() => {
        callOrder.push('message-created');
        return Promise.resolve(message);
      });
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });
      transaction.chatRoomMember.findMany.mockResolvedValue([
        { userId: owner.id },
      ]);
      notificationsService.createInTransaction.mockImplementation(() => {
        callOrder.push('notification-persisted');
        return Promise.resolve(notificationResult);
      });
      prisma.$transaction.mockImplementation(async (callback) => {
        const result = await callback(transaction);
        callOrder.push('committed');
        return result as unknown;
      });
      notificationsService.publishCreated.mockImplementation(() => {
        callOrder.push('notification-published');
        return Promise.resolve();
      });

      await expect(
        service.persistMessage(currentUser.id, roomId, {
          content: 'Hello',
          clientMessageId: 'client-1',
        }),
      ).resolves.toEqual({ message, wasCreated: true });

      expect(callOrder).toEqual([
        'message-created',
        'notification-persisted',
        'committed',
        'notification-published',
      ]);
    });

    it('keeps a newly committed message successful when post-commit notification publishing fails', async () => {
      const message = makeMessage();
      const notificationResult = {
        notification: { id: 'notification-id', userId: owner.id },
        wasCreated: true,
      };
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatMessage.create.mockResolvedValue(message);
      transaction.chatRoom.update.mockResolvedValue({ id: roomId });
      transaction.chatRoomMember.findMany.mockResolvedValue([
        { userId: owner.id },
      ]);
      notificationsService.createInTransaction.mockResolvedValue(
        notificationResult,
      );
      notificationsService.publishCreated.mockRejectedValue(
        new Error('socket failed'),
      );

      await expect(
        service.persistMessage(currentUser.id, roomId, {
          content: 'Sensitive message content',
          clientMessageId: 'client-1',
        }),
      ).resolves.toEqual({ message, wasCreated: true });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.chatMessage.create).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to publish 1 chat notification event(s) after commit',
      );
      expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain(
        'Sensitive message content',
      );
      loggerSpy.mockRestore();
    });

    it('repairs a missing notification on idempotent retry without creating another message', async () => {
      const message = makeMessage();
      const repairedNotification = {
        notification: { id: 'notification-id', userId: owner.id },
        wasCreated: true,
      };
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatRoomMember.findMany.mockResolvedValue([
        { userId: owner.id },
      ]);

      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
      prisma.chatMessage.findUnique.mockResolvedValue(message);
      notificationsService.createInTransaction.mockResolvedValue(
        repairedNotification,
      );

      await expect(
        service.persistMessage(currentUser.id, roomId, {
          content: 'Hello',
          clientMessageId: 'client-1',
        }),
      ).resolves.toEqual({ message, wasCreated: false });

      expect(transaction.chatMessage.create).not.toHaveBeenCalled();
      expect(notificationsService.createInTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          userId: owner.id,
          relatedChatRoomId: roomId,
        }),
      );
      expect(notificationsService.publishCreated).toHaveBeenCalledWith(
        repairedNotification,
      );
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
      prisma.chatMessage.findFirst.mockResolvedValue({ id: 'last-message-id' });

      await expect(service.markAsRead(currentUser.id, roomId)).resolves.toEqual(
        { readState, lastReadMessageId: 'last-message-id' },
      );
      expect(prisma.chatMessage.findFirst).toHaveBeenCalledWith({
        where: {
          roomId,
          senderId: { not: currentUser.id },
          deletedAt: null,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      expect(prisma.chatRoomMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId_userId: { roomId, userId: currentUser.id },
          },
        }),
      );
    });

    it('returns a null message boundary when the room has no incoming message', async () => {
      const readState = { roomId, userId: currentUser.id, lastReadAt: now };
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.chatMessage.findFirst.mockResolvedValue(null);
      prisma.chatRoomMember.update.mockResolvedValue(readState);

      await expect(service.markAsRead(currentUser.id, roomId)).resolves.toEqual(
        { readState, lastReadMessageId: null },
      );
    });
  });

  describe('deleteRoom', () => {
    it('hard deletes a room for either active member', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatRoom.delete.mockResolvedValue({ id: roomId });

      await service.deleteRoom(currentUser.id, roomId);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.chatRoom.findUnique).toHaveBeenCalledWith({
        where: { id: roomId },
        select: {
          id: true,
          members: {
            where: { userId: currentUser.id, leftAt: null },
            select: { id: true },
          },
        },
      });
      expect(transaction.chatRoom.delete).toHaveBeenCalledWith({
        where: { id: roomId },
      });
    });

    it('relies on the ChatRoom relation cascade to remove linked notifications', () => {
      const schema = readFileSync(
        resolve(process.cwd(), 'prisma/schema.prisma'),
        'utf8',
      );

      expect(schema).toMatch(
        /relatedChatRoom\s+ChatRoom\?\s+@relation\(fields: \[relatedChatRoomId\], references: \[id\], onDelete: Cascade\)/,
      );
    });

    it('does not delete a room for a non-member', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [],
      });

      await expect(service.deleteRoom(currentUser.id, roomId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(transaction.chatRoom.delete).not.toHaveBeenCalled();
    });

    it('returns not found when the room disappears before deletion', async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatRoom.delete.mockRejectedValue({ code: 'P2025' });

      await expect(service.deleteRoom(currentUser.id, roomId)).rejects.toThrow(
        new NotFoundException('Chat room not found'),
      );
    });

    it('deletes every image asset before hard deleting the room', async () => {
      const imageMessageIds = ['image-message-1', 'image-message-2'];
      prisma.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      prisma.chatMessage.findMany.mockResolvedValue(
        imageMessageIds.map((id) => ({ id })),
      );
      transaction.chatRoom.findUnique.mockResolvedValue({
        id: roomId,
        members: [{ id: 'member-id' }],
      });
      transaction.chatRoom.delete.mockResolvedValue({ id: roomId });

      await service.deleteRoom(currentUser.id, roomId);

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { roomId, imageUrl: { not: null } },
        select: { id: true },
      });
      expect(cloudinaryService.deleteChatImage).toHaveBeenCalledTimes(2);
      expect(cloudinaryService.deleteChatImage).toHaveBeenCalledWith(
        'image-message-1',
      );
      expect(cloudinaryService.deleteChatImage).toHaveBeenCalledWith(
        'image-message-2',
      );
      expect(
        cloudinaryService.deleteChatImage.mock.invocationCallOrder[1],
      ).toBeLessThan(transaction.chatRoom.delete.mock.invocationCallOrder[0]);
    });
  });

  describe('deleteImageAssetsForUserRooms', () => {
    it('deletes images from every room removed by account deletion', async () => {
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: 'image-message-1' },
        { id: 'image-message-2' },
      ]);

      await service.deleteImageAssetsForUserRooms(currentUser.id);

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          imageUrl: { not: null },
          room: { members: { some: { userId: currentUser.id } } },
        },
        select: { id: true },
      });
      expect(cloudinaryService.deleteChatImage).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteRoomsForUser', () => {
    it('deletes every room found through membership so room cascades remove all participant data', async () => {
      transaction.chatRoom.deleteMany.mockResolvedValue({ count: 2 });

      await expect(
        service.deleteRoomsForUser(transaction, currentUser.id),
      ).resolves.toEqual({ count: 2 });
      expect(transaction.chatRoom.deleteMany).toHaveBeenCalledWith({
        where: { members: { some: { userId: currentUser.id } } },
      });
    });
  });
});
