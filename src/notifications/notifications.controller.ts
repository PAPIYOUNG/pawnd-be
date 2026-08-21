import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { NotificationsService } from '@/notifications/notifications.service';
import { ListNotificationsDto } from '@/notifications/dto/list-notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.findAll(userId, query);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Get(':id')
  async findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.notificationsService.findOne(userId, id);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.notificationsService.remove(userId, id);
  }
}
