import { Module } from '@nestjs/common';
import { GoogleAuthService } from '@/infrastructure/google/google-auth.service';

@Module({
  providers: [GoogleAuthService],
  exports: [GoogleAuthService],
})
export class GoogleAuthModule {}
