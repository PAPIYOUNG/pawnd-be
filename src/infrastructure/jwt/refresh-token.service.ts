import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { generateToken, hashToken } from '@/common/utils/token.util';

const REFRESH_TOKEN_TTL_DAYS = 7;
const REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME = 30;

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, rememberMe = false): Promise<string> {
    const token = generateToken();
    const ttlDays = rememberMe
      ? REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME
      : REFRESH_TOKEN_TTL_DAYS;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return token;
  }

  async verify(token: string): Promise<string> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (
      !record ||
      record.revokedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return record.userId;
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
