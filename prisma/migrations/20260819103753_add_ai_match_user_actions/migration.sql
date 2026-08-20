-- CreateTable
CREATE TABLE "ai_match_user_actions" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_match_user_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_match_user_actions_match_id_idx" ON "ai_match_user_actions"("match_id");

-- CreateIndex
CREATE INDEX "ai_match_user_actions_post_id_idx" ON "ai_match_user_actions"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_match_user_actions_match_id_post_id_key" ON "ai_match_user_actions"("match_id", "post_id");

-- AddForeignKey
ALTER TABLE "ai_match_user_actions" ADD CONSTRAINT "ai_match_user_actions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "ai_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_match_user_actions" ADD CONSTRAINT "ai_match_user_actions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "pet_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
