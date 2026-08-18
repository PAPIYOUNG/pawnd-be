import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { MailService } from '@/infrastructure/mail/mail.service';
import { RegisterDto } from '@/auth/dto/register.dto';
import {
  generateOtp,
  generateToken,
  hashToken,
} from '@/common/utils/token.util';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { LoginDto } from './dto/login.dto';
import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import { RefreshTokenService } from '@/infrastructure/jwt/refresh-token.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyTwoFactorDto } from './dto/verify-2fa.dto';

const EMAIL_VERIFICATION_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;
const TWO_FACTOR_TTL_MINUTES = 5;

const PASSWORD_RESET_TTL_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptService: BcryptService,
    private readonly mailService: MailService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.bcryptService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await this.sendVerificationEmail(user.id, user.email);

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.bcryptService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'PENDING_EMAIL_VERIFICATION') {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const requiresTwoFactor =
      user.lastLoginAt === null || user.twoFactorEnabled;

    if (requiresTwoFactor) {
      const tempToken = await this.issueTwoFactorChallenge(user.id, user.email);
      return { tempToken, message: 'OTP sent to your email' };
    }

    const accessToken = await this.accessTokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await this.refreshTokenService.issue(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user };
  }

  async refresh(dto: RefreshTokenDto) {
    const userId = await this.refreshTokenService.verify(dto.refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenService.revoke(dto.refreshToken);

    const accessToken = await this.accessTokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.refreshTokenService.issue(user.id);

    return { accessToken, refreshToken };
  }

  async logout(dto: RefreshTokenDto) {
    await this.refreshTokenService.revoke(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const token = generateToken();

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(
            Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
          ),
        },
      });

      await this.mailService.send({
        to: user.email,
        subject: 'Reset your Pawnd password',
        text: `Your password reset token: ${token}`,
      });
    }

    return { message: 'Password reset link sent to email' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashToken(dto.token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.bcryptService.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email: dto.email,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const isMatch = verification.otpHash === hashToken(dto.otp);

    if (!isMatch) {
      const attempts = verification.attempts + 1;

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.prisma.emailVerification.delete({
          where: { id: verification.id },
        });
      } else {
        await this.prisma.emailVerification.update({
          where: { id: verification.id },
          data: { attempts },
        });
      }

      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.delete({
        where: { id: verification.id },
      }),
      this.prisma.user.update({
        where: { id: verification.userId },
        data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== 'PENDING_EMAIL_VERIFICATION') {
      throw new BadRequestException('Email is already verified');
    }

    await this.sendVerificationEmail(user.id, user.email);

    return { message: 'Verification email resent' };
  }

  private async sendVerificationEmail(userId: string, email: string) {
    const otp = generateOtp();

    await this.prisma.emailVerification.deleteMany({
      where: { email },
    });

    await this.prisma.emailVerification.create({
      data: {
        userId,
        email,
        otpHash: hashToken(otp),
        expiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
        ),
      },
    });

    await this.mailService.send({
      to: email,
      subject: 'Verify your Pawnd account',
      text: `Your verification code: ${otp}`,
    });
  }

  async verifyTwoFactor(dto: VerifyTwoFactorDto) {
    const challenge = await this.prisma.twoFactorChallenge.findFirst({
      where: {
        tempTokenHash: hashToken(dto.tempToken),
        expiresAt: { gt: new Date() },
      },
    });

    if (!challenge) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const isMatch = challenge.otpHash === hashToken(dto.otp);

    if (!isMatch) {
      const attempts = challenge.attempts + 1;

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.prisma.twoFactorChallenge.delete({
          where: { id: challenge.id },
        });
      } else {
        await this.prisma.twoFactorChallenge.update({
          where: { id: challenge.id },
          data: { attempts },
        });
      }

      throw new BadRequestException('Invalid or expired verification code');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.prisma.twoFactorChallenge.delete({
      where: { id: challenge.id },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.accessTokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await this.refreshTokenService.issue(user.id);

    return { accessToken, refreshToken };
  }

  private async issueTwoFactorChallenge(
    userId: string,
    email: string,
  ): Promise<string> {
    const tempToken = generateToken();
    const otp = generateOtp();

    await this.prisma.twoFactorChallenge.deleteMany({
      where: { userId },
    });

    await this.prisma.twoFactorChallenge.create({
      data: {
        userId,
        tempTokenHash: hashToken(tempToken),
        otpHash: hashToken(otp),
        expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MINUTES * 60 * 1000),
      },
    });

    await this.mailService.send({
      to: email,
      subject: 'Your Pawnd login code',
      text: `Your login verification code: ${otp}`,
    });

    return tempToken;
  }

  async enableTwoFactor(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { message: '2FA enabled successfully' };
  }

  async disableTwoFactor(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    });

    return { message: '2FA disabled successfully' };
  }
}
