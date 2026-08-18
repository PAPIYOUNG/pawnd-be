import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetService } from './pet.service';

@Controller('pets')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPet(
    @CurrentUser('sub') ownerId: string,
    @Body() createPetDto: CreatePetDto,
  ) {
    return this.petService.createPet(ownerId, createPetDto);
  }
}
