/*
  Warnings:

  - A unique constraint covering the columns `[post_image_id,model_name]` on the table `image_embeddings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "image_embeddings_post_image_id_model_name_key" ON "image_embeddings"("post_image_id", "model_name");
