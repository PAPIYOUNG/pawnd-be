import { AiService } from '@/ai/ai.service';
import { Public } from '@/common/decorators/public.decorator';
import { Controller, Get } from '@nestjs/common';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Get('test')
  testConnection() {
    return this.aiService.testConnection();
  }
}
