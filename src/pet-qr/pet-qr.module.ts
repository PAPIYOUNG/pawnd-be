import { Module } from '@nestjs/common';

import { PetQrController } from './pet-qr.controller';
import { PetQrService } from './pet-qr.service';

@Module({
  controllers: [PetQrController],
  providers: [PetQrService],
  exports: [PetQrService],
})
export class PetQrModule {}
