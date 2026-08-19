import { Module } from '@nestjs/common';
import { UsersController } from '@/users/users.controller';
import { UsersService } from '@/users/users.service';
import { HashModule } from '@/infrastructure/hash/hash.module';
import { UploadModule } from '@/infrastructure/upload/upload.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [HashModule, UploadModule],
})
export class UsersModule {}
