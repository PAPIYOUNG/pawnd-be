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

@Injectable()
export class PetQrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
    const qrImageUrl = await this.generateQrImage(publicProfileUrl);

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

  private generateQrImage(publicProfileUrl: string): Promise<string> {
    return QRCode.toDataURL(publicProfileUrl, {
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
