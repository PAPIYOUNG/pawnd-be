import { DatabaseModule } from '@/database/database.module';
import { UploadModule } from '@/infrastructure/upload/upload.module';
import { Module } from '@nestjs/common';
import { FlyerController } from './flyer.controller';
import { FlyerService } from './flyer.service';

@Module({
  imports: [DatabaseModule, UploadModule],
  controllers: [FlyerController],
  providers: [FlyerService],
  exports: [FlyerService],
})
export class FlyerModule {}
