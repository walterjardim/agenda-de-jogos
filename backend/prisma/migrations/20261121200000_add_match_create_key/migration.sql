ALTER TABLE "matches" ADD COLUMN "create_key" TEXT;

CREATE UNIQUE INDEX "matches_team_id_create_key_key" ON "matches"("team_id", "create_key");
