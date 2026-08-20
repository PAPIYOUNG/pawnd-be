import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class GeneratePetAvatarDto {
  @IsUUID()
  petId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsUrl({}, { each: true })
  imageUrls: string[];
}
