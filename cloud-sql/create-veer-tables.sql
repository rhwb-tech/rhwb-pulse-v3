-- Cloud SQL: veer_feedback table
-- Stores HIPAA-sensitive user questions and AI responses
-- Keyed by runner_id (UUID) — no PII stored here
--
-- Note: veer_user_workouts remains as a Supabase view (no stored data to migrate)

CREATE TABLE IF NOT EXISTS veer_feedback (
    id                  SERIAL PRIMARY KEY,
    message_id          TEXT NOT NULL,
    runner_id           UUID NOT NULL,
    feedback            TEXT NOT NULL,
    user_question       TEXT,
    assistant_response  TEXT,
    comment             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_veer_feedback_msg_runner UNIQUE (message_id, runner_id)
);
CREATE INDEX IF NOT EXISTS idx_veer_feedback_runner ON veer_feedback (runner_id);
