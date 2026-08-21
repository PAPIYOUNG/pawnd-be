import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { HomeService } from './home.service';
import { GetLatestPostsDto } from './dto/get-latest-posts.dto';
import { GetReunitedPostsDto } from './dto/get-reunited-posts.dto';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Public()
  @Get('stats')
  async getSummaryStats() {
    return this.homeService.getSummaryStats();
  }

  @Public()
  @Get('latest')
  async getLatestPosts(@Query() dto: GetLatestPostsDto) {
    return this.homeService.getLatestPosts(dto);
  }

  @Public()
  @Get('reunited')
  async getRecentReunited(@Query() dto: GetReunitedPostsDto) {
    return this.homeService.getRecentReunited(dto);
  }

  @Public()
  @Get('content')
  getHomepageContent() {
    return this.homeService.getHomepageContent();
  }
}
