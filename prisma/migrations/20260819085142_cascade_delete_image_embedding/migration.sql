-- DropForeignKey
ALTER TABLE "image_embeddings" DROP CONSTRAINT "image_embeddings_post_image_id_fkey";

-- AddForeignKey
ALTER TABLE "image_embeddings" ADD CONSTRAINT "image_embeddings_post_image_id_fkey" FOREIGN KEY ("post_image_id") REFERENCES "post_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
