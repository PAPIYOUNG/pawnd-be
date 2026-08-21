import { ChatService } from '@/chat/chat.service';
import { PrismaService } from '@/database/prisma.service';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { MailService } from '@/infrastructure/mail/mail.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

describe('UsersService deleteAccount', () => {
  let service: UsersService;

  const userId = '10000000-0000-4000-8000-000000000001';
  const passwordHash = 'stored-password-hash';
  const transaction = {
    user: {
      update: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    chatRoom: {
      deleteMany: jest.fn(),
    },
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const bcryptService = {
    compare: jest.fn(),
    hash: jest.fn(),
  };
  const cloudinaryService = {
    deleteAsset: jest.fn(),
  };
  const mailService = {
    send: jest.fn(),
  };
  const chatService = {
    deleteRoomsForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      passwordHash,
      avatarUrl: null,
    });
    bcryptService.compare.mockResolvedValue(true);
    chatService.deleteRoomsForUser.mockResolvedValue({ count: 2 });
    transaction.user.update.mockResolvedValue({ id: userId });
    transaction.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: BcryptService, useValue: bcryptService },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: MailService, useValue: mailService },
        { provide: ChatService, useValue: chatService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('cleans up chat, anonymizes the account, and revokes tokens in one transaction', async () => {
    await expect(
      service.deleteAccount(userId, { password: 'correct-password' }),
    ).resolves.toEqual({ message: 'Account deleted successfully' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(chatService.deleteRoomsForUser).toHaveBeenCalledWith(
      transaction,
      userId,
    );
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        firstName: 'Deleted',
        lastName: 'User',
        email: `deleted-${userId}@pawnd.invalid`,
        passwordHash: null,
        phone: null,
        lineId: null,
        avatarUrl: null,
        address: null,
        status: 'DELETED',
      },
    });
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(
      chatService.deleteRoomsForUser.mock.invocationCallOrder[0],
    ).toBeLessThan(transaction.user.update.mock.invocationCallOrder[0]);
    expect(transaction.user.update.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.refreshToken.updateMany.mock.invocationCallOrder[0],
    );
  });

  it('does not delete chat when the password is incorrect', async () => {
    bcryptService.compare.mockResolvedValue(false);

    await expect(
      service.deleteAccount(userId, { password: 'wrong-password' }),
    ).rejects.toThrow(new UnauthorizedException('Password is incorrect'));
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(chatService.deleteRoomsForUser).not.toHaveBeenCalled();
    expect(cloudinaryService.deleteAsset).not.toHaveBeenCalled();
  });

  it('does not anonymize the account or revoke tokens when chat cleanup fails in the transaction', async () => {
    chatService.deleteRoomsForUser.mockRejectedValue(
      new Error('transaction failed'),
    );

    await expect(
      service.deleteAccount(userId, { password: 'correct-password' }),
    ).rejects.toThrow('transaction failed');
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(cloudinaryService.deleteAsset).not.toHaveBeenCalled();
  });

  it('deletes the deterministic Cloudinary avatar before starting the database transaction', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash,
      avatarUrl: 'https://res.cloudinary.com/example/avatar.png',
    });

    await service.deleteAccount(userId, { password: 'correct-password' });

    expect(cloudinaryService.deleteAsset).toHaveBeenCalledWith(
      `pawnd/avatars/${userId}`,
      'image',
    );
    expect(
      cloudinaryService.deleteAsset.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
  });

  it('does not start the database transaction when Cloudinary deletion fails', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash,
      avatarUrl: 'https://res.cloudinary.com/example/avatar.png',
    });
    cloudinaryService.deleteAsset.mockRejectedValue(
      new Error('cloudinary failed'),
    );

    await expect(
      service.deleteAccount(userId, { password: 'correct-password' }),
    ).rejects.toThrow('cloudinary failed');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(chatService.deleteRoomsForUser).not.toHaveBeenCalled();
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('skips Cloudinary and runs the database transaction when the account has no avatar', async () => {
    await service.deleteAccount(userId, { password: 'correct-password' });

    expect(cloudinaryService.deleteAsset).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates a database error after Cloudinary deletion succeeds', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash,
      avatarUrl: 'https://res.cloudinary.com/example/avatar.png',
    });
    transaction.user.update.mockRejectedValue(new Error('database failed'));

    await expect(
      service.deleteAccount(userId, { password: 'correct-password' }),
    ).rejects.toThrow('database failed');
    expect(cloudinaryService.deleteAsset).toHaveBeenCalledTimes(1);
    expect(chatService.deleteRoomsForUser).toHaveBeenCalledWith(
      transaction,
      userId,
    );
    expect(transaction.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
