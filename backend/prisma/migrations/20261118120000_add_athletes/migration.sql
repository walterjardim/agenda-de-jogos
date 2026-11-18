-- CreateTable
CREATE TABLE "athletes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "shirt_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "athletes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "athletes_shirt_number_range" CHECK ("shirt_number" BETWEEN 0 AND 999),
    CONSTRAINT "athletes_status_check" CHECK ("status" IN ('active', 'injured', 'suspended'))
);

CREATE UNIQUE INDEX "athletes_team_id_shirt_number_key" ON "athletes"("team_id", "shirt_number");

ALTER TABLE "athletes" ADD CONSTRAINT "athletes_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athletes" ENABLE ROW LEVEL SECURITY;
