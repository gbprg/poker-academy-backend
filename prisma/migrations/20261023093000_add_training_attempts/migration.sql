-- CreateTable
CREATE TABLE "training_attempt" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "action_type" VARCHAR(20) NOT NULL,
    "sizing" DECIMAL(12,4),
    "score" DECIMAL(6,5) NOT NULL,
    "ev_delta" DECIMAL(14,6),
    "scoring_version" VARCHAR(40) NOT NULL,
    "feedback" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_attempt_question_id_idx" ON "training_attempt"("question_id");

-- CreateIndex
CREATE INDEX "training_attempt_user_id_created_at_idx" ON "training_attempt"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "training_attempt_question_id_idempotency_key_key" ON "training_attempt"("question_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "training_attempt" ADD CONSTRAINT "training_attempt_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "training_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attempt" ADD CONSTRAINT "training_attempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

