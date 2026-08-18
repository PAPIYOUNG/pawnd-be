import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { HashModule } from '@/infrastructure/hash/hash.module';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';
import { MailModule } from '@/infrastructure/mail/mail.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [HashModule, JwtModule, MailModule],
})
export class AuthModule {}
