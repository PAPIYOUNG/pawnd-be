import { EnvVariableType } from '@/config/env.validate';
import { CloudinaryResourceType } from '@/infrastructure/upload/type/cloudinary-resource.types';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiOptions } from 'cloudinary';
import { Readable } from 'stream';

@Injectable({})
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  constructor(
    private readonly configService: ConfigService<EnvVariableType, true>,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME', {
        infer: true,
      }),
      api_key: this.configService.get('CLOUDINARY_API_KEY', { infer: true }),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET', {
        infer: true,
      }),
    });
  }
  upload(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const writableStream = cloudinary.uploader.upload_stream(
        (error, result) => {
          if (error || !result) {
            this.logger.error(error);
            reject(new InternalServerErrorException('Upload fail'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      Readable.from(file.buffer).pipe(writableStream);
    });
  }

  uploadAvatar(file: Express.Multer.File, userId: string): Promise<string> {
    return this.uploadBuffer(file.buffer, {
      resource_type: 'image',
      folder: 'pawnd/avatars',
      public_id: userId,
      overwrite: true,
      invalidate: true,
    });
  }

  uploadPetQrCode(qrBuffer: Buffer, petId: string): Promise<string> {
    return this.uploadBuffer(qrBuffer, {
      resource_type: 'image',
      folder: 'pawnd/pet-qr',
      public_id: petId,
      overwrite: true,
      invalidate: true,
      format: 'png',
    });
  }

  uploadFlyerPdf(pdfBuffer: Buffer, postId: string): Promise<string> {
    return this.uploadBuffer(pdfBuffer, {
      resource_type: 'raw',
      folder: 'pawnd/flyers',
      public_id: `${postId}-${Date.now()}.pdf`,
      overwrite: true,
      invalidate: true,
    });
  }

  uploadFlyerQrCode(qrBuffer: Buffer, postId: string): Promise<string> {
    return this.uploadBuffer(qrBuffer, {
      resource_type: 'image',
      folder: 'pawnd/flyer-qr',
      public_id: postId,
      overwrite: true,
      invalidate: true,
      format: 'png',
    });
  }

  private uploadBuffer(
    buffer: Buffer,
    options: UploadApiOptions = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);

            reject(new InternalServerErrorException('Upload failed'));

            return;
          }

          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  }

  deletePetQrCode(petId: string): Promise<void> {
    // Public ID ไม่มี .png
    const publicId = `pawnd/pet-qr/${petId}`;

    return this.deleteAsset(publicId, 'image');
  }

  async deleteAsset(
    publicId: string,
    resourceType: CloudinaryResourceType = 'image',
  ): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      if (result.result !== 'ok' && result.result !== 'not found') {
        this.logger.error(`Failed to delete Cloudinary asset: ${publicId}`);

        throw new InternalServerErrorException('Failed to delete file');
      }
    } catch (error: unknown) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(
        `Cloudinary delete failed: ${publicId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Failed to delete file');
    }
  }
}
