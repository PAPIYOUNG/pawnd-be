import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { validate } from '@/config/env.validate';

import { AuthGuard } from '@/auth/guards/auth.guard';
import { RoleGuard } from '@/auth/guards/role.guard';

import { AuthModule } from '@/auth/auth.module';
import { DatabaseModule } from '@/database/database.module';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';
import { MapModule } from '@/map/map.module';
import { PetModule } from '@/pet/pet.module';
import { PetQrModule } from './pet-qr/pet-qr.module';

import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { TransformInterceptor } from '@/common/intercepter/Transform.interceptor';
import { UsersModule } from './users/users.module';

import { PostEventsModule } from './post-events/post-events.module';
import { FlyerModule } from './flyer/flyer.module';
import { HomeModule } from './home/home.module';

import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validate,
    }),
    DatabaseModule,
    AuthModule,
    JwtModule,
    MapModule,
    PetModule,
    PetQrModule,
    UsersModule,
    PostEventsModule,
    FlyerModule,
    HomeModule,
    DatabaseModule,
    AiModule,
    NotificationsModule,
    AdminModule,
    ChatModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
