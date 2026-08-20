import { IsUUID } from 'class-validator';
import { SendChatMessageDto } from './send-chat-message.dto';

export class ChatRoomEventDto {
  @IsUUID()
  roomId: string;
}

export class SendChatMessageEventDto extends SendChatMessageDto {
  @IsUUID()
  roomId: string;
}
