/*
  Warnings:

  - You are about to drop the column `is_read` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `related_conversation_id` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the `conversation_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `conversations` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[room_id,sender_id,client_message_id]` on the table `chat_messages` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[post_id,created_by_id]` on the table `chat_rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_room_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_room_members" DROP CONSTRAINT "chat_room_members_room_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_room_members" DROP CONSTRAINT "chat_room_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_post_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation_members" DROP CONSTRAINT "conversation_members_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "conversation_members" DROP CONSTRAINT "conversation_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_related_post_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_related_conversation_id_fkey";

-- AlterTable
ALTER TABLE "chat_messages" DROP COLUMN "is_read",
DROP COLUMN "updated_at",
ADD COLUMN     "client_message_id" VARCHAR(100),
ALTER COLUMN "image_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "chat_room_members" ADD COLUMN     "last_read_at" TIMESTAMP(3),
ADD COLUMN     "left_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "last_message_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "related_conversation_id",
ADD COLUMN     "related_chat_room_id" UUID;

-- DropTable
DROP TABLE "conversation_members";

-- DropTable
DROP TABLE "conversations";

-- CreateIndex
CREATE INDEX "chat_messages_room_id_created_at_id_idx" ON "chat_messages"("room_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "chat_messages_sender_id_idx" ON "chat_messages"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_room_id_sender_id_client_message_id_key" ON "chat_messages"("room_id", "sender_id", "client_message_id");

-- CreateIndex
CREATE INDEX "chat_room_members_user_id_idx" ON "chat_room_members"("user_id");

-- CreateIndex
CREATE INDEX "chat_rooms_post_id_idx" ON "chat_rooms"("post_id");

-- CreateIndex
CREATE INDEX "chat_rooms_created_by_id_idx" ON "chat_rooms"("created_by_id");

-- CreateIndex
CREATE INDEX "chat_rooms_last_message_at_idx" ON "chat_rooms"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_post_id_created_by_id_key" ON "chat_rooms"("post_id", "created_by_id");

-- CreateIndex
CREATE INDEX "notifications_related_chat_room_id_idx" ON "notifications"("related_chat_room_id");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "pet_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_chat_room_id_fkey" FOREIGN KEY ("related_chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
