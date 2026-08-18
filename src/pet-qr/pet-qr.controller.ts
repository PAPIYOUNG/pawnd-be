import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PetQrResponseDto } from './dto/pet-qr-response.dto';
import { PetQrService } from './pet-qr.service';
import { Public } from '@/common/decorators/public.decorator';

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

  @Patch(':id/qr/deactivate')
  deactivatePetQrCode(
    @Param('id', ParseUUIDPipe) petId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<PetQrResponseDto> {
    return this.petQrService.deactivatePetQrCode(petId, userId);
  }

  @Public()
  @Get('public/qr/:qrToken')
  getPublicPetProfile(@Param('qrToken') qrToken: string) {
    return this.petQrService.getPublicPetProfile(qrToken);
  }

  @Get(':id/qr')
  getPetQrCode(
    @Param('id', ParseUUIDPipe) petId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<PetQrResponseDto> {
    return this.petQrService.getPetQrCode(petId, userId);
  }
}
