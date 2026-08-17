import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';
import { RegisterDto } from '@/auth/dto/register.dto';
import { VerifyEmailDto } from '@/auth/dto/verify-email.dto';
import { ResendVerificationDto } from '@/auth/dto/resend-verification.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { RefreshTokenDto } from '@/auth/dto/refresh-token.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return { user, message: 'Registration successful' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  async getMe(@CurrentUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
