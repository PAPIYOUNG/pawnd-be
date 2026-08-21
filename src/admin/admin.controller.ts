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
import { UserRole } from '@/database/generated/prisma/enums';
import { AdminService } from './admin.service';
import { GetUsersDto } from './dto/get-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { GetPetsDto } from './dto/get-pets.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { UpdatePostStatusDto } from './dto/update-post-status.dto';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 1
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
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
  updateCommunityPostVisibility() {}

  // 11
  @Delete('community/posts/:id')
  deleteCommunityPost() {}

  // 12
  @Patch('community/comments/:id/hide')
  updateCommentVisibility() {}

  // 13
  @Delete('community/comments/:id')
  deleteComment() {}

  // 14
  @Get('reports')
  getReports() {}

  // 15
  @Patch('reports/:id')
  reviewReport() {}
}
