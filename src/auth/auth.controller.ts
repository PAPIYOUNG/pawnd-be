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
import { VerifyTwoFactorDto } from '@/auth/dto/verify-2fa.dto';
import { ResendTwoFactorDto } from '@/auth/dto/resend-2fa.dto';
import { GoogleLoginDto } from '@/auth/dto/google-login.dto';
import { LineLoginDto } from '@/auth/dto/line-login.dto';
import { CompleteLineDto } from '@/auth/dto/complete-line.dto';

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

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('google')
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('line')
  async loginWithLine(@Body() dto: LineLoginDto) {
    return this.authService.loginWithLine(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('line/complete')
  async completeLineRegistration(@Body() dto: CompleteLineDto) {
    return this.authService.completeLineRegistration(dto);
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

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/verify')
  async verifyTwoFactor(@Body() dto: VerifyTwoFactorDto) {
    return this.authService.verifyTwoFactor(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/resend')
  async resendTwoFactor(@Body() dto: ResendTwoFactorDto) {
    return this.authService.resendTwoFactor(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('2fa/enable')
  async enableTwoFactor(@CurrentUser('sub') userId: string) {
    return this.authService.enableTwoFactor(userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('2fa/disable')
  async disableTwoFactor(@CurrentUser('sub') userId: string) {
    return this.authService.disableTwoFactor(userId);
  }
}
