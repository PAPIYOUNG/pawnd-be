import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
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

  @Get()
  async listMyPets(@CurrentUser('sub') ownerId: string) {
    return this.petService.listMyPets(ownerId);
  }

  @Get(':id')
  async getPetDetail(
    @CurrentUser('sub') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petService.getPetDetail(ownerId, id);
  }

  @Patch(':id')
  async updatePet(
    @CurrentUser('sub') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePetDto: UpdatePetDto,
  ) {
    return this.petService.updatePet(ownerId, id, updatePetDto);
  }

  @Delete(':id')
  async deletePet(
    @CurrentUser('sub') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petService.deletePet(ownerId, id);
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images'))
  async uploadPetImages(
    @CurrentUser('sub') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.petService.uploadPetImages(ownerId, id, files);
  }

  @Delete(':id/images/:imageId')
  async deletePetImage(
    @CurrentUser('sub') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.petService.deletePetImage(ownerId, id, imageId);
  }
}
