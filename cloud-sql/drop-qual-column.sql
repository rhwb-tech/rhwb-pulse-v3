-- Drop meso_qual_score column from rhwb_coach_input
-- Run ONLY after 1-2 weeks of verifying the full pipeline works in production.
-- The view update (update-view-remove-qual.sql) must be applied first.

ALTER TABLE rhwb_coach_input DROP COLUMN meso_qual_score;
