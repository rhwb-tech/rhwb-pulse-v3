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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`qual-scores-api listening on port ${PORT}`);
});
