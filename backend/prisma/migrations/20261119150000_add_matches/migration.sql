CREATE TABLE "uniform_pieces" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "piece_type" TEXT NOT NULL CHECK ("piece_type" IN ('shirt', 'shorts', 'socks')),
    "uniform_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL DEFAULT '#000000' CHECK ("color_hex" ~ '^#[0-9A-Fa-f]{6}$'),
    "is_home_default" BOOLEAN NOT NULL DEFAULT false,
    "is_away_default" BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX "uniform_pieces_team_id_id_idx" ON "uniform_pieces"("team_id", "id");
CREATE UNIQUE INDEX "uq_piece_home_default" ON "uniform_pieces"("team_id", "piece_type") WHERE "is_home_default";
CREATE UNIQUE INDEX "uq_piece_away_default" ON "uniform_pieces"("team_id", "piece_type") WHERE "is_away_default";

CREATE TABLE "matches" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "competition_id" UUID REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "opponent" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT CHECK (char_length("notes") <= 2000),
    "is_home" BOOLEAN NOT NULL DEFAULT true,
    "shirt_piece_id" UUID REFERENCES "uniform_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "shorts_piece_id" UUID REFERENCES "uniform_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "socks_piece_id" UUID REFERENCES "uniform_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "referee_fee_cents" INTEGER CHECK ("referee_fee_cents" >= 0),
    "has_saved_callup" BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX "idx_matches_team_date" ON "matches"("team_id", "starts_at", "id");

CREATE TABLE "callups" (
    "match_id" UUID NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "athlete_id" UUID NOT NULL REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("match_id", "athlete_id")
);

CREATE INDEX "callups_athlete_id_idx" ON "callups"("athlete_id");

ALTER TABLE "uniform_pieces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "callups" ENABLE ROW LEVEL SECURITY;
