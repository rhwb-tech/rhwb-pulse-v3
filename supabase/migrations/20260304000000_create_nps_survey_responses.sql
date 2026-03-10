-- NPS Survey Responses table (dual-write target for coach portal views)
CREATE TABLE IF NOT EXISTS nps_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id UUID NOT NULL,
  email_id TEXT NOT NULL,
  coach_email TEXT,
  season TEXT NOT NULL,
  feedback_quality INT CHECK (feedback_quality BETWEEN 0 AND 10),
  communication INT CHECK (communication BETWEEN 0 AND 10),
  relationship INT CHECK (relationship BETWEEN 0 AND 10),
  recommendation INT CHECK (recommendation BETWEEN 0 AND 10),
  comments TEXT,
  rhwb_effectiveness INT CHECK (rhwb_effectiveness BETWEEN 0 AND 10),
  rhwb_knowledge_depth INT CHECK (rhwb_knowledge_depth BETWEEN 0 AND 10),
  rhwb_recommendation INT CHECK (rhwb_recommendation BETWEEN 0 AND 10),
  rhwb_comments TEXT,
  program TEXT,
  are_you_a_new_or_return_runner_to_rhwb TEXT,
  race_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(runner_id, season)
);

-- RLS: runners can only read their own rows
ALTER TABLE nps_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Runners can view own survey responses" ON nps_survey_responses;
CREATE POLICY "Runners can view own survey responses"
  ON nps_survey_responses FOR SELECT
  USING (email_id = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "Service role can insert survey responses" ON nps_survey_responses;
CREATE POLICY "Service role can insert survey responses"
  ON nps_survey_responses FOR INSERT
  WITH CHECK (true);

-- Drop existing views and dependents, then recreate from new table
DROP VIEW IF EXISTS v_survey_response_rate CASCADE;
DROP VIEW IF EXISTS v_survey_results CASCADE;
DROP VIEW IF EXISTS v_nps_scores CASCADE;

-- View for coach portal (v_survey_results)
-- Coach portal filters on coach_email via .eq('coach_email', coachEmailFilter)
CREATE VIEW v_survey_results AS
SELECT
  id,
  runner_id,
  email_id,
  coach_email,
  season,
  feedback_quality,
  communication,
  relationship,
  recommendation,
  comments,
  rhwb_effectiveness,
  rhwb_knowledge_depth,
  rhwb_recommendation,
  rhwb_comments,
  program,
  are_you_a_new_or_return_runner_to_rhwb,
  race_type,
  created_at
FROM nps_survey_responses;

-- View for NPS scores (aggregated by coach)
CREATE VIEW v_nps_scores AS
SELECT
  coach_email,
  season,
  COUNT(*) AS response_count,
  ROUND(AVG(feedback_quality), 1) AS avg_feedback_quality,
  ROUND(AVG(communication), 1) AS avg_communication,
  ROUND(AVG(relationship), 1) AS avg_relationship,
  ROUND(AVG(recommendation), 1) AS avg_recommendation,
  ROUND(AVG(rhwb_effectiveness), 1) AS avg_rhwb_effectiveness,
  ROUND(AVG(rhwb_knowledge_depth), 1) AS avg_rhwb_knowledge_depth,
  ROUND(AVG(rhwb_recommendation), 1) AS avg_rhwb_recommendation
FROM nps_survey_responses
WHERE coach_email IS NOT NULL
GROUP BY coach_email, season;
