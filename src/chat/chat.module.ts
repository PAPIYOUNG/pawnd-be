import { DatabaseModule } from '@/database/database.module';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [DatabaseModule, JwtModule, NotificationsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
