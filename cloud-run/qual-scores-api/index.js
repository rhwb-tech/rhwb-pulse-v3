const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Cloud SQL connection via Auth Proxy (Unix socket in Cloud Run)
const pool = new Pool({
  host: process.env.CLOUD_SQL_CONNECTION_NAME
    ? `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`
    : process.env.CLOUD_SQL_HOST,
  database: process.env.CLOUD_SQL_DATABASE,
  user: process.env.CLOUD_SQL_USER,
  password: process.env.CLOUD_SQL_PASSWORD,
  max: 5,
});

// Validate API key middleware
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check (no auth required)
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// Get qual scores for given runner_ids and season
app.post('/get-qual-scores', validateApiKey, async (req, res) => {
  try {
    const { runner_ids, season } = req.body;

    if (!runner_ids || !Array.isArray(runner_ids) || runner_ids.length === 0) {
      return res.status(400).json({ error: 'runner_ids array is required' });
    }
    if (!season || typeof season !== 'string') {
      return res.status(400).json({ error: 'season string is required' });
    }

    // Cap runner_ids to prevent abuse
    const limitedIds = runner_ids.slice(0, 200);

    const result = await pool.query(
      `SELECT meso, qual_score AS qual
       FROM qual_scores
       WHERE runner_id = ANY($1::uuid[]) AND season = $2
         AND qual_score IS NOT NULL AND qual_score != ''
       ORDER BY CAST(NULLIF(regexp_replace(meso, '\\D', '', 'g'), '') AS INTEGER) DESC`,
      [limitedIds, season]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching qual scores:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get qual scores by runner_ids (used by coach-portal edge function)
app.post('/get-qual-scores-by-coach', validateApiKey, async (req, res) => {
  try {
    const { runner_ids, season, meso } = req.body;

    if (!runner_ids || !Array.isArray(runner_ids) || runner_ids.length === 0) {
      return res.status(400).json({ error: 'runner_ids array is required' });
    }
    if (!season || typeof season !== 'string') {
      return res.status(400).json({ error: 'season string is required' });
    }

    const limitedIds = runner_ids.slice(0, 200);

    let query, params;
    if (meso) {
      query = `SELECT runner_id, meso, qual_score
               FROM qual_scores
               WHERE runner_id = ANY($1::uuid[]) AND season = $2 AND meso = $3
                 AND qual_score IS NOT NULL AND qual_score != ''`;
      params = [limitedIds, season, meso];
    } else {
      query = `SELECT runner_id, meso, qual_score
               FROM qual_scores
               WHERE runner_id = ANY($1::uuid[]) AND season = $2
                 AND qual_score IS NOT NULL AND qual_score != ''
               ORDER BY CAST(NULLIF(regexp_replace(meso, '\\D', '', 'g'), '') AS INTEGER) DESC`;
      params = [limitedIds, season];
    }

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching qual scores by coach:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get action request comments from Cloud SQL
app.post('/get-action-comments', validateApiKey, async (req, res) => {
  try {
    const { action_request_ids } = req.body;

    if (!action_request_ids || !Array.isArray(action_request_ids) || action_request_ids.length === 0) {
      return res.status(400).json({ error: 'action_request_ids array is required' });
    }

    const limitedIds = action_request_ids.slice(0, 500);

    const result = await pool.query(
      `SELECT action_request_id, comment, action_type, runner_id, requestor_id, season, created_at
       FROM action_comments
       WHERE action_request_id = ANY($1::uuid[])`,
      [limitedIds]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching action comments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upsert action request comment into Cloud SQL
app.post('/upsert-action-comment', validateApiKey, async (req, res) => {
  try {
    const { action_request_id, runner_id, requestor_id, season, comment, action_type } = req.body;

    if (!action_request_id || !runner_id || !requestor_id || !season || !comment || !action_type) {
      return res.status(400).json({
        error: 'action_request_id, runner_id, requestor_id, season, comment, and action_type are required'
      });
    }

    await pool.query(
      `INSERT INTO action_comments (action_request_id, runner_id, requestor_id, season, comment, action_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (action_request_id)
       DO UPDATE SET comment = $5, action_type = $6, updated_at = NOW()`,
      [action_request_id, runner_id, requestor_id, season, comment, action_type]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error upserting action comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Write qual score (for data pipeline use)
app.post('/upsert-qual-score', validateApiKey, async (req, res) => {
  try {
    const { runner_id, season, meso, qual_score, source_table } = req.body;

    if (!runner_id || !season || !meso || !qual_score) {
      return res.status(400).json({ error: 'runner_id, season, meso, and qual_score are required' });
    }

    await pool.query(
      `INSERT INTO qual_scores (runner_id, season, meso, qual_score, source_table)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (runner_id, season, meso)
       DO UPDATE SET qual_score = $4, source_table = $5, updated_at = NOW()`,
      [runner_id, season, meso, qual_score, source_table || 'rhwb_coach_input']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error upserting qual score:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity comment categories for given runner_ids, season, and optional meso
app.post('/get-activity-comment-categories', validateApiKey, async (req, res) => {
  try {
    const { runner_ids, season_no, meso } = req.body;

    if (!runner_ids || !Array.isArray(runner_ids) || runner_ids.length === 0) {
      return res.status(400).json({ error: 'runner_ids array is required' });
    }
    if (season_no === undefined || season_no === null) {
      return res.status(400).json({ error: 'season_no is required' });
    }

    const limitedIds = runner_ids.slice(0, 500);
    const params = [limitedIds, season_no];
    const mesoFilter = meso ? 'AND meso = $3' : '';
    if (meso) params.push(meso);

    const result = await pool.query(
      `SELECT category, COUNT(*)::int AS count,
              ARRAY_AGG(comment_text ORDER BY comment_text) AS comments
       FROM activities_comments
       WHERE runner_id = ANY($1::uuid[]) AND season_no = $2
         AND category IS NOT NULL ${mesoFilter}
       GROUP BY category
       ORDER BY count DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching activity comment categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get feedback metrics (runs with comments) for given runner_ids, season, and optional meso
app.post('/get-feedback-metrics', validateApiKey, async (req, res) => {
  try {
    const { runner_ids, season_no, meso } = req.body;

    if (!runner_ids || !Array.isArray(runner_ids) || runner_ids.length === 0) {
      return res.status(400).json({ error: 'runner_ids array is required' });
    }
    if (season_no === undefined || season_no === null) {
      return res.status(400).json({ error: 'season_no is required' });
    }

    const limitedIds = runner_ids.slice(0, 500);
    const params = [limitedIds, season_no];
    const mesoFilter = meso ? 'AND meso = $3' : '';
    if (meso) params.push(meso);

    const result = await pool.query(
      `SELECT COUNT(DISTINCT workout_key)::int AS runs_with_comments
       FROM activities_comments
       WHERE runner_id = ANY($1::uuid[]) AND season_no = $2 ${mesoFilter}`,
      params
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching feedback metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk-update category on activities_comments
app.post('/categorize-activity-comments', validateApiKey, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates array is required' });
    }

    for (const u of updates) {
      if (!u.workout_key || !u.comment_user || !u.category) continue;
      await pool.query(
        `UPDATE activities_comments SET category = $1, updated_at = NOW()
         WHERE workout_key = $2 AND comment_user = $3`,
        [u.category, u.workout_key, u.comment_user]
      );
    }

    res.json({ success: true, updated: updates.length });
  } catch (err) {
    console.error('Error categorizing activity comments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get uncategorized coach comments from Cloud SQL (used by categorize_comments.js)
app.post('/get-uncategorized-comments', validateApiKey, async (req, res) => {
  try {
    const { coach_emails } = req.body;

    if (!coach_emails || !Array.isArray(coach_emails) || coach_emails.length === 0) {
      return res.status(400).json({ error: 'coach_emails array is required' });
    }

    const result = await pool.query(
      `SELECT workout_key, comment_text, comment_user
       FROM activities_comments
       WHERE LOWER(comment_user) = ANY($1::text[]) AND category IS NULL`,
      [coach_emails.map(e => e.toLowerCase())]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching uncategorized comments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`qual-scores-api listening on port ${PORT}`);
});
