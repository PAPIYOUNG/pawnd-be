import { AiService } from '@/ai/ai.service';
import { AnalyzeImageDto } from '@/ai/dto/analyze-image.dto';
import { Public } from '@/common/decorators/public.decorator';
import { Body, Controller, Get, Post } from '@nestjs/common';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Get('test')
  testConnection() {
    return this.aiService.testConnection();
  }

  @Post('analyze-image')
  analyzeImage(@Body() dto: AnalyzeImageDto) {
    return this.aiService.analyzeImage(dto.imageUrl);
  }
}
