-- CreateTable
CREATE TABLE "review_item" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "spot_id" UUID NOT NULL,
    "strategy_version_id" UUID NOT NULL,
    "node_id" UUID,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "ease_factor" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "last_reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "review_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_item_user_spot_version_node_key" ON "review_item"("user_id", "spot_id", "strategy_version_id", "node_id");

-- CreateIndex
CREATE INDEX "review_item_user_id_due_at_idx" ON "review_item"("user_id", "due_at");

-- AddForeignKey
ALTER TABLE "review_item" ADD CONSTRAINT "review_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
