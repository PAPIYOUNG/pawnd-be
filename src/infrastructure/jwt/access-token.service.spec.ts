import { UserRole, UserStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AccessTokenService } from './access-token.service';

describe('AccessTokenService', () => {
  let service: AccessTokenService;

  const userId = '10000000-0000-4000-8000-000000000001';
  const payload = {
    sub: userId,
    email: 'user@example.com',
    role: UserRole.USER,
  };
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jwtService.verifyAsync.mockResolvedValue(payload);
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AccessTokenService);
  });

  it('returns the original payload for a valid JWT and active user', async () => {
    await expect(service.verify('valid-token')).resolves.toBe(payload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { status: true },
    });
  });

  it.each([UserStatus.DELETED, UserStatus.SUSPENDED, UserStatus.BLACKLISTED])(
    'rejects a user with %s status',
    async (status) => {
      prisma.user.findUnique.mockResolvedValue({ status });

      await expect(service.verify('valid-token')).rejects.toThrow(
        new UnauthorizedException('Account is not active'),
      );
    },
  );

  it('rejects a valid JWT when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.verify('valid-token')).rejects.toThrow(
      new UnauthorizedException('Account is not active'),
    );
  });

  it.each([{}, { sub: '' }, { sub: '   ' }, { sub: 123 }])(
    'rejects a payload without a valid subject before querying the user',
    async (invalidPayload) => {
      jwtService.verifyAsync.mockResolvedValue(invalidPayload);

      await expect(service.verify('valid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid or expired access token'),
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each([
    new JsonWebTokenError('invalid signature'),
    new TokenExpiredError('jwt expired', new Date()),
  ])('propagates JWT verification errors', async (error) => {
    jwtService.verifyAsync.mockRejectedValue(error);

    await expect(service.verify('invalid-token')).rejects.toBe(error);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
