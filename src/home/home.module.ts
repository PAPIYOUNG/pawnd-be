import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { HomeGateway } from './home.gateway';

@Module({
  controllers: [HomeController],
  providers: [HomeService, HomeGateway],
  exports: [HomeService, HomeGateway],
})
export class HomeModule {}
