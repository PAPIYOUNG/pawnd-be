import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { GenerateFlyerDto } from './dto/generate-flyer.dto';
import { FlyerService } from './flyer.service';

@Controller('posts')
export class FlyerController {
  constructor(private readonly flyerService: FlyerService) {}

  @Post(':id/flyer')
  @HttpCode(HttpStatus.CREATED)
  async generateFlyer(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: GenerateFlyerDto,
  ) {
    return this.flyerService.generateFlyer(userId, postId, dto);
  }

  @Get(':id/flyer')
  async getPostFlyer(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.flyerService.getPostFlyer(userId, postId);
  }

  @Get(':id/flyer/download')
  @Header('Content-Type', 'application/pdf')
  async downloadFlyer(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.flyerService.downloadFlyer(userId, postId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="flyer-${postId}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });

    return new StreamableFile(buffer);
  }

  @Get(':id/flyers')
  async listPostFlyers(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.flyerService.listPostFlyers(userId, postId);
  }
}
