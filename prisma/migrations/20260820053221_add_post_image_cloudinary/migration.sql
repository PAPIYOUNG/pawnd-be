-- AlterTable
ALTER TABLE "post_images" ADD COLUMN     "cloudinary_public_id" TEXT,
ADD COLUMN     "cloudinary_resource_type" TEXT DEFAULT 'image';
