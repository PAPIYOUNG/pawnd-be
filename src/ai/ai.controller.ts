import { AiMatchingService } from '@/ai/ai-matching.service';
import { AiService } from '@/ai/ai.service';
import { AnalyzeImageDto } from '@/ai/dto/analyze-image.dto';
import { GeneratePetAvatarDto } from '@/ai/dto/generate-pet-avatar.dto';
import { EmbeddingService } from '@/ai/service/embedding.service';
import { PetAvatarService } from '@/ai/service/pet-avatar.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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
  matchPost(
    @CurrentUser('sub') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.aiMatchingService.matchPost(userId, postId);
  }

  @Get('posts/:postId/matches')
  getPostMatches(
    @CurrentUser('sub') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.aiMatchingService.getPostMatches(userId, postId);
  }

  @Patch('posts/:postId/matches/:matchId/pin')
  togglePinMatch(
    @CurrentUser('sub') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ) {
    return this.aiMatchingService.togglePinMatch(userId, postId, matchId);
  }

  @Patch('posts/:postId/matches/:matchId/dismiss')
  toggleDismissMatch(
    @CurrentUser('sub') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ) {
    return this.aiMatchingService.toggleDismissMatch(userId, postId, matchId);
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
