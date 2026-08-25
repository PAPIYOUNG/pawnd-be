import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGateway } from '@/admin/admin.gateway';
import { AiModule } from '@/ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGateway],
})
export class AdminModule {}
