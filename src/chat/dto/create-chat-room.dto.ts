import { IsUUID } from 'class-validator';

export class CreateChatRoomDto {
  @IsUUID()
  postId: string;
}
