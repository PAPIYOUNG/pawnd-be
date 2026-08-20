import { AiMatchingService } from '@/ai/ai-matching.service';
import { AiService } from '@/ai/ai.service';
import { AnalyzeImageDto } from '@/ai/dto/analyze-image.dto';
import { GeneratePetAvatarDto } from '@/ai/dto/generate-pet-avatar.dto';
import { EmbeddingService } from '@/ai/service/embedding.service';
import { PetAvatarService } from '@/ai/service/pet-avatar.service';
import { Public } from '@/common/decorators/public.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiMatchingService: AiMatchingService,
    private readonly embeddingService: EmbeddingService,
    private readonly petAvatarService: PetAvatarService,
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
  //สร้างvector
  @Post('embedding/:postImageId')
  createEmbedding(@Param('postImageId') postImageId: string) {
    return this.embeddingService.createImageEmbedding(postImageId);
  }

  //test weight finalscore
  @Get('similarity')
  calculateSimilarity(
    @Query('sourcePostId') sourcePostId: string,
    @Query('candidatePostId') candidatePostId: string,
  ) {
    return this.embeddingService.calculatePostSimilarity(
      sourcePostId,
      candidatePostId,
    );
  }

  @Post('match/:postId')
  matchPost(@Param('postId') postId: string) {
    return this.aiMatchingService.matchPost(postId);
  }

  @Get('posts/:id/matches')
  getPostMatches(@Param('id') id: string) {
    return this.aiMatchingService.getPostMatches(id);
  }

  @Patch('posts/:postId/matches/:matchId/pin')
  togglePinMatch(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ) {
    return this.aiMatchingService.togglePinMatch(postId, matchId);
  }

  @Patch('posts/:postId/matches/:matchId/dismiss')
  toggleDismissMatch(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ) {
    return this.aiMatchingService.toggleDismissMatch(postId, matchId);
  }

  @Get('matches/:matchId')
  getMatchDetail(
    @Param('matchId', ParseUUIDPipe)
    matchId: string,
  ) {
    return this.aiMatchingService.getMatchDetail(matchId);
  }

  @Post('generate-pet-avatar')
  generatePetAvatar(
    @Body()
    dto: GeneratePetAvatarDto,
  ) {
    return this.petAvatarService.generatePetAvatar(dto);
  }
}
