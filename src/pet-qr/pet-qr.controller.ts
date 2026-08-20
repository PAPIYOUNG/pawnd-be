import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';

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

  @Public()
  @Get('public/qr/:qrToken/pdf')
  @Header('Content-Type', 'application/pdf')
  async downloadPublicPetProfilePdf(
    @Param('qrToken') qrToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.petQrService.generatePublicPetProfilePdf(qrToken);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="pet-profile-${qrToken}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });

    return new StreamableFile(buffer);
  }

  @Get(':id/qr')
  getPetQrCode(
    @Param('id', ParseUUIDPipe) petId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<PetQrResponseDto> {
    return this.petQrService.getPetQrCode(petId, userId);
  }
}
