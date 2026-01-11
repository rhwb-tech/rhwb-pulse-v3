import React from 'react';
import { Box, Grid, Typography, Skeleton, Alert } from '@mui/material';
import QuantitativeScores, { QuantitativeScoreData } from '../QuantitativeScores';
import CumulativeScore from '../CumulativeScore';
import ActivitySummary from '../ActivitySummary';
import TrainingFeedback from '../TrainingFeedback';

interface DashboardWidgetsProps {
  loading: boolean;
  error: string | null;
  data: QuantitativeScoreData[];
  cumulativeScore: number | null;
  activitySummary: {
    mileage: { percent: number | null; planned: number | null; completed: number | null };
    strength: { percent: number | null; planned: number | null; completed: number | null };
  };
  trainingFeedback: Array<{ meso: string; qual: string }>;
  userEmail: string;
}

const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  loading,
  error,
  data,
  cumulativeScore,
  activitySummary,
  trainingFeedback,
  userEmail
}) => {
  if (loading) {
    return (
      <Box>
        {/* Bar Chart Skeleton */}
        <Skeleton variant="rectangular" height={400} sx={{ mb: 3, borderRadius: 3 }} />

        {/* Gauges Row Skeleton */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>

        {/* Training Feedback Skeleton */}
        <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Quantitative Scores Chart - Full Width */}
      <Box sx={{ mb: 3 }}>
        {data.length > 0 ? (
          <QuantitativeScores data={data} />
        ) : (
          <Typography variant="body1" color="text.secondary" align="center">
            No quantitative score data available for this selection.
          </Typography>
        )}
      </Box>

      {/* Row 2: Cumulative Score & Activity Summary - Side by Side */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <CumulativeScore score={cumulativeScore ?? 0} />
        </Grid>

        <Grid item xs={12} md={6}>
          <ActivitySummary activityData={activitySummary} />
        </Grid>
      </Grid>

      {/* Row 3: Training Feedback - Full Width */}
      <Box>
        <TrainingFeedback
          feedback={trainingFeedback}
          userEmail={userEmail}
        />
      </Box>
    </Box>
  );
};

export default DashboardWidgets;
