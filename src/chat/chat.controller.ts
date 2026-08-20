import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageQueryDto } from './dto/chat-message-query.dto';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  async createRoom(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateChatRoomDto,
  ) {
    return this.chatService.createOrGetRoom(userId, dto);
  }

  @Get('rooms')
  async listRooms(@CurrentUser('sub') userId: string) {
    return this.chatService.listRooms(userId);
  }

  @Get('rooms/:roomId')
  async getRoom(
    @CurrentUser('sub') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.chatService.getRoom(userId, roomId);
  }

  @Get('rooms/:roomId/messages')
  async listMessages(
    @CurrentUser('sub') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query() query: ChatMessageQueryDto,
  ) {
    return this.chatService.listMessages(userId, roomId, query);
  }

  @Post('rooms/:roomId/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chatService.sendMessage(userId, roomId, dto);
  }

  @Patch('rooms/:roomId/read')
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.chatService.markAsRead(userId, roomId);
  }

  @Delete('rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(
    @CurrentUser('sub') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<void> {
    await this.chatService.deleteRoom(userId, roomId);
  }
}
