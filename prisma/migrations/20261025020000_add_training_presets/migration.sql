-- CreateTable
CREATE TABLE "training_preset" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "filters" JSONB NOT NULL,
    "scenario" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "training_preset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_preset_user_id_updated_at_idx" ON "training_preset"("user_id", "updated_at");

-- AddForeignKey
ALTER TABLE "training_preset" ADD CONSTRAINT "training_preset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
