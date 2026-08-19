import { DatabaseModule } from '@/database/database.module';
import { Module } from '@nestjs/common';
import { PetController } from './pet.controller';
import { PetService } from './pet.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
