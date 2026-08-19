-- CreateEnum
CREATE TYPE "post_event_type" AS ENUM (
  'POST_CREATED',
  'AI_MATCHES_FOUND',
  'AI_MATCH_CONFIRMED',
  'REUNITED',
  'POST_CLOSED'
);

-- AlterTable
ALTER TABLE "post_events"
ALTER COLUMN "event_type" TYPE "post_event_type"
USING ("event_type"::"post_event_type");