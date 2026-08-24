import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const DEFAULT_CHAT_MESSAGE_LIMIT = 30;
export const MAX_CHAT_MESSAGE_LIMIT = 100;

export class ChatMessageQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CHAT_MESSAGE_LIMIT)
  limit: number = DEFAULT_CHAT_MESSAGE_LIMIT;
}
