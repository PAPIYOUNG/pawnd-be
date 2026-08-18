-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('LOCAL', 'GOOGLE', 'LINE');

-- CreateEnum
CREATE TYPE "pet_type" AS ENUM ('DOG', 'CAT', 'BIRD', 'HAMSTER', 'EXOTIC', 'OTHER');

-- CreateEnum
CREATE TYPE "pet_gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "post_type" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "post_status" AS ENUM ('ACTIVE', 'REUNITED', 'CLOSED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('AI_MATCH', 'NEW_MESSAGE', 'NEW_CLUE', 'PROFILE_VERIFICATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "community_post_type" AS ENUM ('LOST_PET', 'FOUND_PET', 'OTHERS');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('PENDING', 'REVIEWED', 'REJECTED', 'ACTION_TAKEN');

-- CreateEnum
CREATE TYPE "report_type" AS ENUM ('POST', 'COMMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "phone" VARCHAR(30),
    "line_id" VARCHAR(100),
    "avatar_url" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
    "email_verified_at" TIMESTAMP(3),
    "notification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "2fa_enable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50),
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" INTEGER,
    "token_type" VARCHAR(50),
    "scope" TEXT,
    "id_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "pet_type" NOT NULL,
    "breed" VARCHAR(150),
    "gender" "pet_gender",
    "color" VARCHAR(150),
    "age" INTEGER,
    "distinctive_features" TEXT,
    "description" TEXT,
    "profile_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_images" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_profile" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_qr_codes" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "qr_token" VARCHAR(255) NOT NULL,
    "qr_image_url" TEXT,
    "public_profile_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pet_id" UUID,
    "type" "post_type" NOT NULL,
    "status" "post_status" NOT NULL DEFAULT 'ACTIVE',
    "pet_name" VARCHAR(100),
    "pet_type" "pet_type" NOT NULL,
    "breed" VARCHAR(150),
    "gender" "pet_gender",
    "color" VARCHAR(150),
    "distinctive_features" TEXT,
    "description" TEXT,
    "event_date" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "province" VARCHAR(100),
    "district" VARCHAR(100),
    "subdistrict" VARCHAR(100),
    "location_description" TEXT,
    "reward_amount" DECIMAL(12,2),
    "current_location" TEXT,
    "contact_phone" VARCHAR(30),
    "contact_line_id" VARCHAR(100),
    "contact_email" VARCHAR(255),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "reunited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_images" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_embeddings" (
    "id" UUID NOT NULL,
    "post_image_id" UUID NOT NULL,
    "embedding" vector NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "model_version" VARCHAR(50),
    "dimension" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_matches" (
    "id" UUID NOT NULL,
    "lost_post_id" UUID NOT NULL,
    "found_post_id" UUID NOT NULL,
    "vector_similarity" DECIMAL(6,5) NOT NULL,
    "feature_score" DECIMAL(6,5),
    "location_score" DECIMAL(6,5),
    "date_score" DECIMAL(6,5),
    "final_score" DECIMAL(6,5) NOT NULL,
    "distance_km" DECIMAL(10,2),
    "model_name" VARCHAR(100),
    "model_version" VARCHAR(50),
    "is_notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_events" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_by" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flyers" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "qr_url" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "related_post_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_room_members" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "related_post_id" UUID,
    "related_match_id" UUID,
    "related_conversation_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "community_post_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "related_pet_post_id" UUID,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_post_images" (
    "id" UUID NOT NULL,
    "community_post_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comments" (
    "id" UUID NOT NULL,
    "community_post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "report_type" "report_type" NOT NULL,
    "community_post_id" UUID,
    "comment_id" UUID,
    "reason" TEXT NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_key" ON "auth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");

-- CreateIndex
CREATE INDEX "email_verifications_email_idx" ON "email_verifications"("email");

-- CreateIndex
CREATE INDEX "email_verifications_expires_at_idx" ON "email_verifications"("expires_at");

-- CreateIndex
CREATE INDEX "pets_owner_id_idx" ON "pets"("owner_id");

-- CreateIndex
CREATE INDEX "pets_type_idx" ON "pets"("type");

-- CreateIndex
CREATE INDEX "pets_breed_idx" ON "pets"("breed");

-- CreateIndex
CREATE INDEX "pet_images_pet_id_idx" ON "pet_images"("pet_id");

-- CreateIndex
CREATE UNIQUE INDEX "pet_qr_codes_pet_id_key" ON "pet_qr_codes"("pet_id");

-- CreateIndex
CREATE UNIQUE INDEX "pet_qr_codes_qr_token_key" ON "pet_qr_codes"("qr_token");

-- CreateIndex
CREATE INDEX "pet_posts_user_id_idx" ON "pet_posts"("user_id");

-- CreateIndex
CREATE INDEX "pet_posts_pet_id_idx" ON "pet_posts"("pet_id");

-- CreateIndex
CREATE INDEX "pet_posts_type_idx" ON "pet_posts"("type");

-- CreateIndex
CREATE INDEX "pet_posts_status_idx" ON "pet_posts"("status");

-- CreateIndex
CREATE INDEX "pet_posts_pet_type_idx" ON "pet_posts"("pet_type");

-- CreateIndex
CREATE INDEX "pet_posts_breed_idx" ON "pet_posts"("breed");

-- CreateIndex
CREATE INDEX "pet_posts_province_idx" ON "pet_posts"("province");

-- CreateIndex
CREATE INDEX "pet_posts_event_date_idx" ON "pet_posts"("event_date");

-- CreateIndex
CREATE INDEX "pet_posts_latitude_longitude_idx" ON "pet_posts"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "post_images_post_id_idx" ON "post_images"("post_id");

-- CreateIndex
CREATE INDEX "image_embeddings_post_image_id_idx" ON "image_embeddings"("post_image_id");

-- CreateIndex
CREATE INDEX "ai_matches_lost_post_id_idx" ON "ai_matches"("lost_post_id");

-- CreateIndex
CREATE INDEX "ai_matches_found_post_id_idx" ON "ai_matches"("found_post_id");

-- CreateIndex
CREATE INDEX "ai_matches_final_score_idx" ON "ai_matches"("final_score");

-- CreateIndex
CREATE UNIQUE INDEX "ai_matches_lost_post_id_found_post_id_key" ON "ai_matches"("lost_post_id", "found_post_id");

-- CreateIndex
CREATE INDEX "post_events_post_id_idx" ON "post_events"("post_id");

-- CreateIndex
CREATE INDEX "post_events_created_at_idx" ON "post_events"("created_at");

-- CreateIndex
CREATE INDEX "flyers_post_id_idx" ON "flyers"("post_id");

-- CreateIndex
CREATE INDEX "conversations_related_post_id_idx" ON "conversations"("related_post_id");

-- CreateIndex
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_members_conversation_id_user_id_key" ON "conversation_members"("conversation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_room_members_room_id_user_id_key" ON "chat_room_members"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "community_posts_user_id_idx" ON "community_posts"("user_id");

-- CreateIndex
CREATE INDEX "community_posts_type_idx" ON "community_posts"("type");

-- CreateIndex
CREATE INDEX "community_posts_created_at_idx" ON "community_posts"("created_at");

-- CreateIndex
CREATE INDEX "community_post_images_community_post_id_idx" ON "community_post_images"("community_post_id");

-- CreateIndex
CREATE INDEX "community_comments_community_post_id_idx" ON "community_comments"("community_post_id");

-- CreateIndex
CREATE INDEX "community_comments_user_id_idx" ON "community_comments"("user_id");

-- CreateIndex
CREATE INDEX "content_reports_reporter_id_idx" ON "content_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "content_reports_status_idx" ON "content_reports"("status");

-- CreateIndex
CREATE INDEX "content_reports_report_type_idx" ON "content_reports"("report_type");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_images" ADD CONSTRAINT "pet_images_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_qr_codes" ADD CONSTRAINT "pet_qr_codes_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_posts" ADD CONSTRAINT "pet_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_posts" ADD CONSTRAINT "pet_posts_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "pet_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_embeddings" ADD CONSTRAINT "image_embeddings_post_image_id_fkey" FOREIGN KEY ("post_image_id") REFERENCES "post_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_matches" ADD CONSTRAINT "ai_matches_lost_post_id_fkey" FOREIGN KEY ("lost_post_id") REFERENCES "pet_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_matches" ADD CONSTRAINT "ai_matches_found_post_id_fkey" FOREIGN KEY ("found_post_id") REFERENCES "pet_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_events" ADD CONSTRAINT "post_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "pet_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_events" ADD CONSTRAINT "post_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flyers" ADD CONSTRAINT "flyers_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "pet_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_related_post_id_fkey" FOREIGN KEY ("related_post_id") REFERENCES "pet_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "pet_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_post_id_fkey" FOREIGN KEY ("related_post_id") REFERENCES "pet_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_match_id_fkey" FOREIGN KEY ("related_match_id") REFERENCES "ai_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_conversation_id_fkey" FOREIGN KEY ("related_conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_related_pet_post_id_fkey" FOREIGN KEY ("related_pet_post_id") REFERENCES "pet_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_images" ADD CONSTRAINT "community_post_images_community_post_id_fkey" FOREIGN KEY ("community_post_id") REFERENCES "community_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_community_post_id_fkey" FOREIGN KEY ("community_post_id") REFERENCES "community_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_community_post_id_fkey" FOREIGN KEY ("community_post_id") REFERENCES "community_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "community_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
