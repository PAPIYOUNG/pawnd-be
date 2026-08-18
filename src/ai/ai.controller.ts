import { AiMatchingService } from '@/ai/ai-matching.service';
import { AiService } from '@/ai/ai.service';
import { AnalyzeImageDto } from '@/ai/dto/analyze-image.dto';
import { EmbeddingService } from '@/ai/service/embedding.service';
import { Public } from '@/common/decorators/public.decorator';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiMatchingService: AiMatchingService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Public()
  @Get('test')
  testConnection() {
    return this.aiService.testConnection();
  }

  @Post('analyze-image')
  analyzeImage(@Body() dto: AnalyzeImageDto) {
    return this.aiService.analyzeImage(dto.imageUrl);
  }

  @Post(':id/match')
  matchPost(@Param('id') postId: string) {
    return this.aiMatchingService.matchPost(postId);
  }

  @Post('embedding/:postImageId')
  createEmbedding(@Param('postImageId') postImageId: string) {
    return this.embeddingService.createImageEmbedding(postImageId);
  }
}
