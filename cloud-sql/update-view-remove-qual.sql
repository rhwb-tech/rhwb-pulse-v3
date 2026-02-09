-- v_rhwb_meso_scores: Replace qual data with empty strings
-- Run AFTER verifying the Edge Function + Cloud Run pipeline works correctly.
-- The qual column is kept (as '') so v_quantitative_scores and other consumers don't break.

CREATE OR REPLACE VIEW v_rhwb_meso_scores AS
WITH legacy AS (
    SELECT rms.season,
        rms.meso,
        rms.email_id,
        rms.category,
        rms.full_name,
        rms.category_desc,
        rms.phase,
        rms.coach,
        rc.email_id AS coach_email,
        rms.quant::numeric AS quant,
        ''::text AS qual,  -- was: rms.qual
        rms.cumulative_score::numeric AS cumulative_score
    FROM rhwb_meso_scores rms
        LEFT JOIN rhwb_coaches rc ON rms.coach::text = rc.coach
    WHERE NULLIF(regexp_replace(rms.season, '\D'::text, ''::text, 'g'::text), ''::text)::integer <= 13
), base AS (
    SELECT r.season_no,
        r.season,
        r.meso,
        split_part(r.meso, ' '::text, 2)::integer AS meso_n,
        r.email_id,
        r.runner_name,
        r.season_phase AS phase,
        r.coach,
        r.coach_email,
        r.race_distance,
            CASE
                WHEN r.meso_score_override IS NULL THEN r.meso_score
                ELSE r.meso_score_override::numeric
            END AS quant,
        ''::text AS qual  -- was: COALESCE(r.meso_qual_score, ''::text) AS qual
    FROM rhwb_coach_input r
    WHERE r.season_no >= 14 AND r.meso IS NOT NULL AND NULLIF(r.meso, ''::text) IS NOT NULL
), running AS (
    SELECT b.season_no,
        b.season,
        b.meso,
        b.meso_n,
        b.email_id,
        b.runner_name,
        b.phase,
        b.coach,
        b.coach_email,
        b.race_distance,
        b.quant,
        b.qual,
        round(avg(b.quant) OVER (PARTITION BY b.season_no, b.email_id ORDER BY b.meso_n ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 1) AS cumulative_score
    FROM base b
), coach_avg AS (
    SELECT base.season_no,
        base.meso_n,
        base.coach,
        base.phase,
        round(avg(base.quant), 1) AS coach_avg
    FROM base
    GROUP BY base.season_no, base.meso_n, base.coach, base.phase
), rd_avg AS (
    SELECT base.season_no,
        base.meso_n,
        base.race_distance,
        base.phase,
        round(avg(base.quant), 1) AS rd_avg
    FROM base
    GROUP BY base.season_no, base.meso_n, base.race_distance, base.phase
), ui_scores AS (
    SELECT r.season,
        r.meso,
        r.email_id,
        'Personal'::text AS category,
        r.runner_name AS full_name,
        r.runner_name AS category_desc,
        r.phase,
        r.coach,
        r.coach_email,
        r.quant,
        r.qual,
        r.cumulative_score
    FROM running r
  UNION ALL
    SELECT b.season,
        b.meso,
        b.email_id,
        'Coach'::text AS category,
        b.runner_name AS full_name,
        b.coach AS category_desc,
        b.phase,
        b.coach,
        b.coach_email,
        ca.coach_avg AS quant,
        ''::text AS qual,
        0::numeric AS cumulative_score
    FROM base b
        JOIN coach_avg ca ON ca.season_no = b.season_no AND ca.meso_n = b.meso_n AND ca.coach::text = b.coach::text AND ca.phase::text = b.phase::text
  UNION ALL
    SELECT b.season,
        b.meso,
        b.email_id,
        'Race Distance'::text AS category,
        b.runner_name AS full_name,
        b.race_distance AS category_desc,
        b.phase,
        b.coach,
        b.coach_email,
        ra.rd_avg AS quant,
        ''::text AS qual,
        0::numeric AS cumulative_score
    FROM base b
        JOIN rd_avg ra ON ra.season_no = b.season_no AND ra.meso_n = b.meso_n AND ra.race_distance::text = b.race_distance::text AND ra.phase::text = b.phase::text
)
SELECT legacy.season,
    legacy.meso,
    legacy.email_id,
    legacy.category,
    legacy.full_name,
    legacy.category_desc,
    legacy.phase,
    legacy.coach,
    legacy.coach_email,
    legacy.quant,
    legacy.qual,
    legacy.cumulative_score
FROM legacy
UNION ALL
SELECT ui_scores.season,
    ui_scores.meso,
    ui_scores.email_id,
    ui_scores.category,
    ui_scores.full_name,
    ui_scores.category_desc,
    ui_scores.phase,
    ui_scores.coach,
    ui_scores.coach_email,
    ui_scores.quant,
    ui_scores.qual,
    ui_scores.cumulative_score
FROM ui_scores;
