import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PetQrResponseDto } from './dto/pet-qr-response.dto';
import { PetQrService } from './pet-qr.service';
import { Public } from '@/common/decorators/public.decorator';

@Controller('pets')
export class PetQrController {
  constructor(private readonly petQrService: PetQrService) {}
  @Public()
  @Post(':id/qr')
  @HttpCode(HttpStatus.CREATED)
  generatePetQrCode(
    @Param('id', ParseUUIDPipe) petId: string,
    //@CurrentUser('sub') userId: string,
  ): Promise<PetQrResponseDto> {
    return this.petQrService.generatePetQrCode(
      petId,
      '95dc75df-8779-4fa0-957d-0d35e15e2e72',
    );
  }

  @Public()
  @Get('public/qr/:qrToken')
  getPublicPetProfile(@Param('qrToken') qrToken: string) {
    return this.petQrService.getPublicPetProfile(qrToken);
  }
}
