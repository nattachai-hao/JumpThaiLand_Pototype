CREATE TABLE "daily_rewards" (
    "id" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_rewards_day_key" ON "daily_rewards"("day");
