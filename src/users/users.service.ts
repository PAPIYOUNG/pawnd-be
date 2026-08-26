import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { UpdateProfileDto } from '@/users/dto/update-profile.dto';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { ChangePasswordDto } from '@/users/dto/change-password.dto';
import { UnauthorizedException } from '@nestjs/common';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { UpdateSettingsDto } from '@/users/dto/update-settings.dto';
import { MailService } from '@/infrastructure/mail/mail.service';
import { ChangeEmailDto } from '@/users/dto/change-email.dto';
import { VerifyEmailChangeDto } from '@/users/dto/verify-email-change.dto';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { generateOtp, hashToken } from '@/common/utils/token.util';
import { DeleteAccountDto } from '@/users/dto/delete-account.dto';
import { ChatService } from '@/chat/chat.service';

const EMAIL_CHANGE_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptService: BcryptService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
    private readonly chatService: ChatService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        lineId: true,
        avatarUrl: true,
        address: true,
        role: true,
        status: true,
        notificationEnabled: true,
        twoFactorEnabled: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...userWithoutPasswordHash } = user;

    return {
      user: { ...userWithoutPasswordHash, hasPassword: !!passwordHash },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        lineId: true,
        address: true,
        updatedAt: true,
      },
    });

    return { user };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.bcryptService.compare(
      dto.oldPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Old password is incorrect');
    }

    const newPasswordHash = await this.bcryptService.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated successfully' };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const avatarUrl = await this.cloudinaryService.uploadAvatar(file, userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.notificationEnabled !== undefined && {
          notificationEnabled: dto.notificationEnabled,
        }),
        ...(dto['2FAEnabled'] !== undefined && {
          twoFactorEnabled: dto['2FAEnabled'],
        }),
      },
      select: {
        notificationEnabled: true,
        twoFactorEnabled: true,
      },
    });

    return {
      settings: {
        notificationEnabled: user.notificationEnabled,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  async changeEmail(userId: string, dto: ChangeEmailDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const otp = generateOtp();

    await this.prisma.emailVerification.deleteMany({ where: { userId } });

    await this.prisma.emailVerification.create({
      data: {
        userId,
        email: dto.email,
        otpHash: hashToken(otp),
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MINUTES * 60 * 1000),
      },
    });

    await this.mailService.send({
      to: dto.email,
      subject: 'Confirm your new Pawnd email',
      text: `Your verification code: ${otp}`,
    });

    return { message: 'Verification code sent to new email' };
  }

  async verifyEmailChange(userId: string, dto: VerifyEmailChangeDto) {
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        userId,
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
        where: { id: userId },
        data: { email: verification.email, emailVerifiedAt: new Date() },
      }),
    ]);

    return { message: 'Email updated successfully' };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, avatarUrl: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.passwordHash) {
      if (!dto.password) {
        throw new UnauthorizedException('Password is required');
      }

      const passwordMatches = await this.bcryptService.compare(
        dto.password,
        user.passwordHash,
      );

      if (!passwordMatches) {
        throw new UnauthorizedException('Password is incorrect');
      }
    } else {
      if (
        !dto.confirmEmail ||
        dto.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
      ) {
        throw new UnauthorizedException('Email confirmation does not match');
      }
    }

    if (user.avatarUrl) {
      await this.cloudinaryService.deleteAsset(
        `pawnd/avatars/${userId}`,
        'image',
      );
    }

    // ห้องแชตจะถูก hard delete ใน transaction จึง cleanup รูปที่ผูกอยู่ก่อน
    await this.chatService.deleteImageAssetsForUserRooms(userId);

    await this.prisma.$transaction(async (transaction) => {
      await this.chatService.deleteRoomsForUser(transaction, userId);

      await transaction.user.update({
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

      await transaction.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Account deleted successfully' };
  }
}
