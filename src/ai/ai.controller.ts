import { AiMatchingService } from '@/ai/ai-matching.service';
import { AiService } from '@/ai/ai.service';
import { AnalyzeImageDto } from '@/ai/dto/analyze-image.dto';
import { GeneratePetAvatarDto } from '@/ai/dto/generate-pet-avatar.dto';
import { SearchByImageDto } from '@/ai/dto/search-by-image.dto';
import { EmbeddingService } from '@/ai/service/embedding.service';
import { PetAvatarService } from '@/ai/service/pet-avatar.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

const MAX_SEARCH_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_SEARCH_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

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

  @Post('search-by-image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_SEARCH_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_SEARCH_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Only JPEG, PNG, or WEBP images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  searchByImage(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: SearchByImageDto,
  ) {
    return this.aiMatchingService.matchByImage(file, query);
  }

  @Post('generate-pet-avatar')
  generatePetAvatar(
    @CurrentUser('sub') userId: string,
    @Body()
    dto: GeneratePetAvatarDto,
  ) {
    return this.petAvatarService.generatePetAvatar(dto, userId);
  }

  @Get('my-avatars')
  getMyAvatars(@CurrentUser('sub') userId: string) {
    return this.petAvatarService.getMyAvatars(userId);
  }
}
