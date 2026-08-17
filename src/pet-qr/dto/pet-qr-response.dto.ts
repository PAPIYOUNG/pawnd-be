export class PetQrResponseDto {
  id: string;
  petId: string;
  qrToken: string;
  qrImageUrl: string | null;
  publicProfileUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
