-- CreateIndex
CREATE UNIQUE INDEX "training_attempt_question_id_user_id_key" ON "training_attempt"("question_id", "user_id");

