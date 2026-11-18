CREATE TABLE "competitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "competitions_team_id_id_idx" ON "competitions"("team_id", "id");
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competitions" ENABLE ROW LEVEL SECURITY;
