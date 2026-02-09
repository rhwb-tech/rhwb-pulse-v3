-- Cloud SQL: qual_scores table
-- Stores HIPAA-sensitive coach qualitative feedback
-- Keyed by runner_id (UUID) — no PII stored here

CREATE TABLE IF NOT EXISTS qual_scores (
    id              SERIAL PRIMARY KEY,
    runner_id       UUID NOT NULL,
    season          TEXT NOT NULL,
    meso            TEXT NOT NULL,
    qual_score      TEXT NOT NULL,
    source_table    TEXT NOT NULL DEFAULT 'rhwb_coach_input',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_qual_runner_season_meso UNIQUE (runner_id, season, meso)
);

CREATE INDEX IF NOT EXISTS idx_qual_runner_season ON qual_scores (runner_id, season);
