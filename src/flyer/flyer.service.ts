import { PostStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { FlyerTemplate, GenerateFlyerDto } from './dto/generate-flyer.dto';
import { FlyerPdfGenerator } from './generators/flyer-pdf.generator';

@Injectable()
export class FlyerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async generateFlyer(
    _userId: string,
    postId: string,
    dto: GenerateFlyerDto,
  ) {
    const post = await this.prisma.petPost.findUnique({
      where: { id: postId },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        user: true,
        pet: true,
      },
    });

    if (
      !post ||
      post.status === PostStatus.DELETED ||
      post.status === PostStatus.HIDDEN
    ) {
      throw new NotFoundException('Post not found');
    }

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const postUrl = `${frontendUrl.replace(/\/$/, '')}/posts/${postId}`;

    let qrBuffer: Buffer;
    try {
      qrBuffer = await QRCode.toBuffer(postUrl, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 400,
      });
    } catch {
      throw new InternalServerErrorException('Failed to generate QR code');
    }

    let qrUrl: string;
    try {
      qrUrl = await this.cloudinaryService.uploadFlyerQrCode(qrBuffer, postId);
    } catch {
      qrUrl = '';
    }

    let petImageBuffer: Buffer | null = null;
    const primaryImageUrl =
      post.images[0]?.imageUrl || post.pet?.profileImageUrl;

    if (primaryImageUrl) {
      try {
        const res = await fetch(primaryImageUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          petImageBuffer = Buffer.from(arrayBuffer);
        }
      } catch {
        // Proceed if image download fails
      }
    }

    const isClosedCase =
      post.status === PostStatus.REUNITED || post.status === PostStatus.CLOSED;
    const contactPhone = isClosedCase ? null : post.contactPhone;
    const contactLineId = isClosedCase ? null : post.contactLineId;
    const contactEmail = isClosedCase ? null : post.contactEmail;

    const pdfBuffer = await FlyerPdfGenerator.generate(
      {
        id: post.id,
        type: post.type,
        petName: post.petName || post.pet?.name,
        petType: post.petType || post.pet?.type,
        breed: post.breed || post.pet?.breed,
        gender: post.gender || post.pet?.gender,
        color: post.color || post.pet?.color,
        distinctiveFeatures:
          post.distinctiveFeatures || post.pet?.distinctiveFeatures,
        description: post.description || post.pet?.description,
        eventDate: post.eventDate,
        province: post.province,
        district: post.district,
        subdistrict: post.subdistrict,
        locationDescription: post.locationDescription,
        rewardAmount: post.rewardAmount ? Number(post.rewardAmount) : null,
        contactPhone,
        contactLineId,
        contactEmail,
        petImageBuffer,
        qrImageBuffer: qrBuffer,
      },
      dto.template || FlyerTemplate.WANTED,
    );

    await this.cloudinaryService.uploadFlyerPdf(pdfBuffer, postId);

    const port = this.configService.get<number>('PORT', 8000);
    const backendUrl = `http://localhost:${port}`;
    const fileUrl = `${backendUrl}/posts/${postId}/flyer/download`;

    const flyer = await this.prisma.flyer.create({
      data: {
        postId,
        fileUrl,
        qrUrl,
      },
      select: {
        id: true,
        postId: true,
        fileUrl: true,
        qrUrl: true,
        generatedAt: true,
      },
    });

    return { flyer };
  }

  async getPostFlyer(_userId: string, postId: string) {
    const flyer = await this.prisma.flyer.findFirst({
      where: { postId },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        fileUrl: true,
        qrUrl: true,
        generatedAt: true,
      },
    });

    if (!flyer) {
      throw new NotFoundException('Flyer not found');
    }

    return { flyer };
  }

  async downloadFlyer(_userId: string, postId: string): Promise<Buffer> {
    const post = await this.prisma.petPost.findUnique({
      where: { id: postId },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        user: true,
        pet: true,
      },
    });

    if (
      !post ||
      post.status === PostStatus.DELETED ||
      post.status === PostStatus.HIDDEN
    ) {
      throw new NotFoundException('Post not found');
    }

    const flyer = await this.prisma.flyer.findFirst({
      where: { postId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!flyer) {
      throw new NotFoundException('Flyer not found');
    }

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const postUrl = `${frontendUrl.replace(/\/$/, '')}/posts/${postId}`;

    let qrBuffer: Buffer;
    try {
      qrBuffer = await QRCode.toBuffer(postUrl, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 400,
      });
    } catch {
      throw new InternalServerErrorException('Failed to generate QR code');
    }

    let petImageBuffer: Buffer | null = null;
    const primaryImageUrl =
      post.images[0]?.imageUrl || post.pet?.profileImageUrl;

    if (primaryImageUrl) {
      try {
        const res = await fetch(primaryImageUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          petImageBuffer = Buffer.from(arrayBuffer);
        }
      } catch {
        // Proceed if image download fails
      }
    }

    const isClosedCase =
      post.status === PostStatus.REUNITED || post.status === PostStatus.CLOSED;
    const contactPhone = isClosedCase ? null : post.contactPhone;
    const contactLineId = isClosedCase ? null : post.contactLineId;
    const contactEmail = isClosedCase ? null : post.contactEmail;

    return FlyerPdfGenerator.generate({
      id: post.id,
      type: post.type,
      petName: post.petName || post.pet?.name,
      petType: post.petType || post.pet?.type,
      breed: post.breed || post.pet?.breed,
      gender: post.gender || post.pet?.gender,
      color: post.color || post.pet?.color,
      distinctiveFeatures:
        post.distinctiveFeatures || post.pet?.distinctiveFeatures,
      description: post.description || post.pet?.description,
      eventDate: post.eventDate,
      province: post.province,
      district: post.district,
      subdistrict: post.subdistrict,
      locationDescription: post.locationDescription,
      rewardAmount: post.rewardAmount ? Number(post.rewardAmount) : null,
      contactPhone,
      contactLineId,
      contactEmail,
      petImageBuffer,
      qrImageBuffer: qrBuffer,
    });
  }

  async listPostFlyers(_userId: string, postId: string) {
    const flyers = await this.prisma.flyer.findMany({
      where: { postId },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        fileUrl: true,
        generatedAt: true,
      },
    });

    return { flyers };
  }
}
