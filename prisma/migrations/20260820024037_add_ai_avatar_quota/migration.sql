-- CreateTable
CREATE TABLE "ai_avatar_quotas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL DEFAULT 2,
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "reset_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_avatar_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_avatar_quotas_user_id_key" ON "ai_avatar_quotas"("user_id");

-- CreateIndex
CREATE INDEX "ai_avatar_quotas_user_id_idx" ON "ai_avatar_quotas"("user_id");

-- AddForeignKey
ALTER TABLE "ai_avatar_quotas" ADD CONSTRAINT "ai_avatar_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
