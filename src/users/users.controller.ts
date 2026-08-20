import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from '@/users/users.service';
import { UpdateProfileDto } from '@/users/dto/update-profile.dto';
import { ChangePasswordDto } from '@/users/dto/change-password.dto';
import { UpdateSettingsDto } from '@/users/dto/update-settings.dto';
import { ChangeEmailDto } from '@/users/dto/change-email.dto';
import { VerifyEmailChangeDto } from '@/users/dto/verify-email-change.dto';
import { DeleteAccountDto } from '@/users/dto/delete-account.dto';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser('sub') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Only JPEG, PNG, or WEBP images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    return this.usersService.uploadAvatar(userId, file);
  }

  @Patch('me/settings')
  async updateSettings(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(userId, dto);
  }

  @Patch('me/email')
  async changeEmail(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangeEmailDto,
  ) {
    return this.usersService.changeEmail(userId, dto);
  }

  @Post('me/email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmailChange(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyEmailChangeDto,
  ) {
    return this.usersService.verifyEmailChange(userId, dto);
  }

  @Delete('me')
  async deleteAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.usersService.deleteAccount(userId, dto);
  }
}
