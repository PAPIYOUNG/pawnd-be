import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;

  const chatService = {
    createOrGetRoom: jest.fn(),
    listRooms: jest.fn(),
    getRoom: jest.fn(),
    listMessages: jest.fn(),
    sendMessage: jest.fn(),
    markAsRead: jest.fn(),
    deleteRoom: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();

    controller = module.get(ChatController);
    jest.clearAllMocks();
  });

  it('creates or opens a room for the authenticated user', async () => {
    const dto = { postId: '8a5f0894-13ba-4b11-8f01-3f9517a676d8' };
    const expected = { room: { id: 'room-id' } };
    chatService.createOrGetRoom.mockResolvedValue(expected);

    await expect(controller.createRoom('user-id', dto)).resolves.toEqual(
      expected,
    );
    expect(chatService.createOrGetRoom).toHaveBeenCalledWith('user-id', dto);
  });

  it('lists rooms for the authenticated user', async () => {
    const expected = { rooms: [] };
    chatService.listRooms.mockResolvedValue(expected);

    await expect(controller.listRooms('user-id')).resolves.toEqual(expected);
    expect(chatService.listRooms).toHaveBeenCalledWith('user-id');
  });

  it('gets a room for the authenticated user', async () => {
    const expected = { room: { id: 'room-id' } };
    chatService.getRoom.mockResolvedValue(expected);

    await expect(controller.getRoom('user-id', 'room-id')).resolves.toEqual(
      expected,
    );
    expect(chatService.getRoom).toHaveBeenCalledWith('user-id', 'room-id');
  });

  it('passes cursor pagination to the service', async () => {
    const query = { cursor: 'message-id', limit: 20 };
    const expected = { items: [], nextCursor: null };
    chatService.listMessages.mockResolvedValue(expected);

    await expect(
      controller.listMessages('user-id', 'room-id', query),
    ).resolves.toEqual(expected);
    expect(chatService.listMessages).toHaveBeenCalledWith(
      'user-id',
      'room-id',
      query,
    );
  });

  it('sends a message using the authenticated user identity', async () => {
    const dto = { content: 'Hello', clientMessageId: 'client-1' };
    const expected = { message: { id: 'message-id' } };
    chatService.sendMessage.mockResolvedValue(expected);

    await expect(
      controller.sendMessage('user-id', 'room-id', dto),
    ).resolves.toEqual(expected);
    expect(chatService.sendMessage).toHaveBeenCalledWith(
      'user-id',
      'room-id',
      dto,
    );
  });

  it('marks a room as read for the authenticated user', async () => {
    const expected = { readState: { roomId: 'room-id' } };
    chatService.markAsRead.mockResolvedValue(expected);

    await expect(controller.markAsRead('user-id', 'room-id')).resolves.toEqual(
      expected,
    );
    expect(chatService.markAsRead).toHaveBeenCalledWith('user-id', 'room-id');
  });

  it('deletes a room and returns no controller payload', async () => {
    chatService.deleteRoom.mockResolvedValue(undefined);

    await expect(
      controller.deleteRoom('user-id', 'room-id'),
    ).resolves.toBeUndefined();
    expect(chatService.deleteRoom).toHaveBeenCalledWith('user-id', 'room-id');
  });
});
