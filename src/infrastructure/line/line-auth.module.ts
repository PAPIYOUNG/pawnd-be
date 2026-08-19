import { Module } from '@nestjs/common';
import { LineAuthService } from '@/infrastructure/line/line-auth.service';

@Module({
  providers: [LineAuthService],
  exports: [LineAuthService],
})
export class LineAuthModule {}
