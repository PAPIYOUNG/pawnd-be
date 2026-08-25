import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Roles } from '@/common/decorators/role.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@/database/generated/prisma/enums';
import { AdminService } from './admin.service';
import { GetUsersDto } from './dto/get-users.dto';
import { GetMonthlyTrendDto } from './dto/get-monthly-trend.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { GetPetsDto } from './dto/get-pets.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { UpdatePostStatusDto } from './dto/update-post-status.dto';
import { UpdateCommunityPostVisibilityDto } from './dto/update-community-post-visibility.dto';
import { UpdateCommentVisibilityDto } from './dto/update-comment-visibility.dto';
import { ReviewReportDto } from './dto/review-report.dto';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 1
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('dashboard/monthly-trend')
  monthlyTrend(@Query() dto: GetMonthlyTrendDto) {
    return this.adminService.monthlyTrend(dto.year);
  }

  // 2
  @Get('users')
  getUsers(@Query() dto: GetUsersDto) {
    return this.adminService.getUsers(dto);
  }

  // 3
  @Get('users/:id')
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  // 4
  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto);
  }

  // 5
  @Get('pets')
  getPets(@Query() dto: GetPetsDto) {
    return this.adminService.getPets(dto);
  }

  // 6
  @Get('pets/:id')
  getPetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getPetById(id);
  }

  // 7
  @Get('posts')
  getPosts(@Query() dto: GetPostsDto) {
    return this.adminService.getPosts(dto);
  }

  // 8
  @Patch('posts/:id')
  updatePostStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostStatusDto,
  ) {
    return this.adminService.updatePostStatus(id, dto);
  }

  // 9 >> ไม่ทำ ไม่ลบประกาศ เก็บไว้เป็น History
  //   @Delete('posts/:id')
  //   deletePost() {}

  // 10
  @Patch('community/posts/:id/hide')
  updateCommunityPostVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommunityPostVisibilityDto,
  ) {
    return this.adminService.updateCommunityPostVisibility(id, dto);
  }

  // 11
  @Delete('community/posts/:id')
  deleteCommunityPost(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteCommunityPost(id);
  }

  // 12
  @Patch('community/comments/:id/hide')
  updateCommentVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentVisibilityDto,
  ) {
    return this.adminService.updateCommentVisibility(id, dto);
  }

  // 13
  @Delete('community/comments/:id')
  deleteComment(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteComment(id);
  }

  // 14
  @Get('reports')
  getReports() {
    return this.adminService.getReports();
  }

  // 15
  @Patch('reports/:id')
  reviewReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewReportDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.reviewReport(id, dto, adminId);
  }
}
