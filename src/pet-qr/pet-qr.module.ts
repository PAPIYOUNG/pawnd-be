import { Module } from '@nestjs/common';

import { PetQrController } from './pet-qr.controller';
import { PetQrService } from './pet-qr.service';
import { UploadModule } from '@/infrastructure/upload/upload.module';

@Module({
  controllers: [PetQrController],
  providers: [PetQrService],
  exports: [PetQrService],
  imports: [UploadModule],
})
export class PetQrModule {}
