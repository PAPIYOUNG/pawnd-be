import { Module } from '@nestjs/common';
import { NotificationsController } from '@/notifications/notifications.controller';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationsGateway } from '@/notifications/notifications.gateway';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';

@Module({
  imports: [JwtModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
