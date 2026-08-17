import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PetQrResponseDto } from './dto/pet-qr-response.dto';
import { PetQrService } from './pet-qr.service';

@Controller('pets')
export class PetQrController {
  constructor(private readonly petQrService: PetQrService) {}

  @Post(':id/qr')
  @HttpCode(HttpStatus.CREATED)
  generatePetQrCode(
    @Param('id', ParseUUIDPipe) petId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<PetQrResponseDto> {
    return this.petQrService.generatePetQrCode(petId, userId);
  }
}
