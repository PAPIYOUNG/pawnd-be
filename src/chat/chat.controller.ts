import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatMessageQueryDto } from './dto/chat-message-query.dto';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import {
  ALLOWED_CHAT_IMAGE_MIME_TYPES,
  CHAT_IMAGE_MAX_SIZE_BYTES,
  SendChatMessageDto,
} from './dto/send-chat-message.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

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
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: CHAT_IMAGE_MAX_SIZE_BYTES },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_CHAT_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Only JPEG, PNG, or WEBP chat images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: SendChatMessageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const result = await this.chatService.sendMessage(
      userId,
      roomId,
      dto,
      image,
    );
    if (result.wasCreated) {
      this.chatGateway.broadcastNewMessage(result.message);
    }
    return { message: result.message };
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
