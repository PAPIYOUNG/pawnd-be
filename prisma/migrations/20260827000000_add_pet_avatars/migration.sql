-- CreateTable
CREATE TABLE "pet_avatars" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "style" TEXT DEFAULT '3D_VOXEL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_avatars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_avatars_user_id_idx" ON "pet_avatars"("user_id");

-- CreateIndex
CREATE INDEX "pet_avatars_pet_id_idx" ON "pet_avatars"("pet_id");

-- CreateIndex
CREATE INDEX "pet_avatars_created_at_idx" ON "pet_avatars"("created_at");

-- AddForeignKey
ALTER TABLE "pet_avatars" ADD CONSTRAINT "pet_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_avatars" ADD CONSTRAINT "pet_avatars_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
