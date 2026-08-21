import { UserStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from '@/infrastructure/jwt/jwt-payload.type';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  sign(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    const payload: unknown = await this.jwt.verifyAsync(token);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0
    ) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    return payload as AccessTokenPayload;
  }
}
