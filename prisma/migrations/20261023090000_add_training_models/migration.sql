-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "training_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "scenario" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "training_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_question" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "spot_id" UUID NOT NULL,
    "strategy_version_id" UUID NOT NULL,
    "node_id" UUID,
    "snapshot" JSONB NOT NULL,
    "answered_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_session_user_id_status_idx" ON "training_session"("user_id", "status");

-- CreateIndex
CREATE INDEX "training_session_user_id_created_at_idx" ON "training_session"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "training_question_session_id_idx" ON "training_question"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_question_session_id_position_key" ON "training_question"("session_id", "position");

-- AddForeignKey
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_question" ADD CONSTRAINT "training_question_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

