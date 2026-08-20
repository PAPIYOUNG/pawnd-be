import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '@/database/prisma.service';
import { PetQrResponseDto } from './dto/pet-qr-response.dto';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { PublicPetProfileResponseDto } from '@/pet-qr/dto/public-pet-profile-response.dto';
import { PetProfilePdfGenerator } from './generators/pet-profile-pdf.generator';

@Injectable()
export class PetQrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async generatePetQrCode(
    petId: string,
    userId: string,
  ): Promise<PetQrResponseDto> {
    const pet = await this.prisma.pet.findUnique({
      where: {
        id: petId,
      },
      select: {
        id: true,
        ownerId: true,
        qrCode: {
          select: {
            id: true,
            petId: true,
            qrToken: true,
            qrImageUrl: true,
            publicProfileUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    if (pet.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to generate a QR code for this pet',
      );
    }

    // ถ้ามี QR Code ที่ยังใช้งานอยู่แล้ว ให้คืนข้อมูลเดิม
    if (pet.qrCode?.isActive) {
      return pet.qrCode;
    }

    const qrToken = this.generateQrToken();
    const publicProfileUrl = this.buildPublicProfileUrl(qrToken);
    const qrBuffer = await this.generateQrImage(publicProfileUrl);
    // Upload แล้วรับ URL จริงกลับมา
    const qrImageUrl = await this.cloudinary.uploadPetQrCode(qrBuffer, petId);
    /*
     * ถ้าเคยมี QR แต่ถูกปิดใช้งาน:
     * - สร้าง token ใหม่
     * - เปิดใช้งานอีกครั้ง
     *
     * ถ้ายังไม่เคยมี:
     * - สร้าง record ใหม่
     */
    const qrCode = await this.prisma.petQrCode.upsert({
      where: {
        petId,
      },
      create: {
        petId,
        qrToken,
        qrImageUrl,
        publicProfileUrl,
        isActive: true,
      },
      update: {
        qrToken,
        qrImageUrl,
        publicProfileUrl,
        isActive: true,
      },
      select: {
        id: true,
        petId: true,
        qrToken: true,
        qrImageUrl: true,
        publicProfileUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return qrCode;
  }

  async getPublicPetProfile(
    qrToken: string,
  ): Promise<PublicPetProfileResponseDto> {
    const qrCode = await this.prisma.petQrCode.findUnique({
      where: {
        qrToken,
      },
      select: {
        isActive: true,

        pet: {
          select: {
            id: true,
            name: true,
            type: true,
            breed: true,
            gender: true,
            color: true,
            age: true,
            distinctiveFeatures: true,
            description: true,
            profileImageUrl: true,

            images: {
              select: {
                id: true,
                imageUrl: true,
                isProfile: true,
                sortOrder: true,
              },
              orderBy: {
                sortOrder: 'asc',
              },
            },

            owner: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                lineId: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!qrCode || !qrCode.isActive) {
      throw new NotFoundException(
        'Pet profile not found or QR code is inactive',
      );
    }

    const { owner, ...pet } = qrCode.pet;

    return {
      ...pet,
      ownerContact: {
        name: `${owner.firstName} ${owner.lastName}`.trim(),
        phone: owner.phone,
        lineId: owner.lineId,
        email: owner.email,
      },
    };
  }

  async generatePublicPetProfilePdf(qrToken: string): Promise<Buffer> {
    const profile = await this.getPublicPetProfile(qrToken);

    const profileImageBuffer = await this.fetchImageBuffer(
      profile.profileImageUrl,
    );

    const otherImages = profile.images.filter(
      (image) => image.imageUrl !== profile.profileImageUrl,
    );
    const otherImageBuffers: Buffer[] = [];
    for (const image of otherImages.slice(0, 4)) {
      const buffer = await this.fetchImageBuffer(image.imageUrl);
      if (buffer) {
        otherImageBuffers.push(buffer);
      }
    }

    return PetProfilePdfGenerator.generate({
      id: profile.id,
      name: profile.name,
      type: profile.type,
      breed: profile.breed,
      gender: profile.gender,
      color: profile.color,
      age: profile.age,
      distinctiveFeatures: profile.distinctiveFeatures,
      description: profile.description,
      profileImageBuffer,
      otherImageBuffers,
      ownerName: profile.ownerContact.name,
      ownerPhone: profile.ownerContact.phone,
      ownerLineId: profile.ownerContact.lineId,
      ownerEmail: profile.ownerContact.email,
    });
  }

  async deactivatePetQrCode(
    petId: string,
    userId: string,
  ): Promise<PetQrResponseDto> {
    const pet = await this.prisma.pet.findUnique({
      where: {
        id: petId,
      },

      select: {
        ownerId: true,

        qrCode: {
          select: {
            id: true,
            petId: true,
            qrToken: true,
            qrImageUrl: true,
            publicProfileUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    if (pet.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to deactivate this pet QR code',
      );
    }

    if (!pet.qrCode) {
      throw new NotFoundException('Pet QR code not found');
    }

    // ปิดอยู่แล้วและไม่มีรูปบน Cloudinary
    if (!pet.qrCode.isActive && !pet.qrCode.qrImageUrl) {
      return pet.qrCode;
    }

    // ลบรูปออกจาก Cloudinary
    if (pet.qrCode.qrImageUrl) {
      await this.cloudinary.deletePetQrCode(petId);
    }

    // เก็บ QR record ไว้ แต่ปิดการใช้งาน
    return this.prisma.petQrCode.update({
      where: {
        petId,
      },

      data: {
        isActive: false,
        qrImageUrl: null,
      },

      select: {
        id: true,
        petId: true,
        qrToken: true,
        qrImageUrl: true,
        publicProfileUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getPetQrCode(petId: string, userId: string): Promise<PetQrResponseDto> {
    const pet = await this.prisma.pet.findUnique({
      where: {
        id: petId,
      },

      select: {
        ownerId: true,

        qrCode: {
          select: {
            id: true,
            petId: true,
            qrToken: true,
            qrImageUrl: true,
            publicProfileUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    if (pet.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this pet QR code',
      );
    }

    if (!pet.qrCode) {
      throw new NotFoundException('Pet QR code not found');
    }

    return pet.qrCode;
  }

  //ส่วนย่อย

  //สร้างข้อมูลสุ่ม 32 bytes
  //นำข้อมูล binary มาแปลงเป็นข้อความที่ใช้ใน URL
  private generateQrToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private buildPublicProfileUrl(qrToken: string): string {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    return `${frontendUrl.replace(/\/$/, '')}/pet/qr/${qrToken}`;
  }

  // pdfkit อ่านได้แค่ JPEG/PNG เท่านั้น รูปที่อัปโหลดเป็น WebP ต้องสั่ง Cloudinary แปลงให้ก่อน
  private toPdfSafeImageUrl(url: string): string {
    const marker = '/image/upload/';
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) {
      return url;
    }

    const insertAt = markerIndex + marker.length;
    return `${url.slice(0, insertAt)}f_jpg/${url.slice(insertAt)}`;
  }

  private async fetchImageBuffer(url?: string | null): Promise<Buffer | null> {
    if (!url) {
      return null;
    }

    try {
      const res = await fetch(this.toPdfSafeImageUrl(url));
      if (!res.ok) {
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  private generateQrImage(publicProfileUrl: string): Promise<Buffer> {
    return QRCode.toBuffer(publicProfileUrl, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  }
}
