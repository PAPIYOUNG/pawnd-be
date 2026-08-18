import { PetGender, PetType } from '@/database/generated/prisma/enums';

export class PublicPetImageDto {
  id: string;
  imageUrl: string;
  isProfile: boolean;
  sortOrder: number;
}

export class PublicOwnerContactDto {
  name: string;
  phone: string | null;
  lineId: string | null;
  email: string;
}

export class PublicPetProfileResponseDto {
  id: string;
  name: string;
  type: PetType;
  breed: string | null;
  gender: PetGender | null;
  color: string | null;
  age: number | null;
  distinctiveFeatures: string | null;
  description: string | null;
  profileImageUrl: string | null;
  images: PublicPetImageDto[];
  ownerContact: PublicOwnerContactDto;
}
