import { Trim } from '@/common/decorators/trim.decorator';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CLIENT_MESSAGE_ID_MAX_LENGTH = 100;

export class SendChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHAT_MESSAGE_MAX_LENGTH)
  @Trim()
  content: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(CLIENT_MESSAGE_ID_MAX_LENGTH)
  @Trim()
  clientMessageId?: string;
}
