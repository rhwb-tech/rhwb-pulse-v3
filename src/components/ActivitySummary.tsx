import React from 'react';
import { Box, Typography, Stack } from '@mui/material';

interface ActivitySummaryProps {
  mileagePercent: number;
  strengthPercent: number;
}

const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 10;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressCircle({ percent, color, label }: { percent: number; color: string; label: string }) {
  const progress = Math.max(0, Math.min(percent, 100));
  const offset = CIRCUMFERENCE * (1 - progress / 100);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ position: 'relative', width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
        <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          <circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={STROKE_WIDTH}
          />
          <circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.7s' }}
            transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
          />
        </svg>
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Typography variant="h5" fontWeight={700} color="#222" sx={{ lineHeight: 1 }}>
            {progress.toFixed(1)}%
          </Typography>
          <Typography variant="subtitle1" color="#555" sx={{ mt: 0.5 }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

const ActivitySummary: React.FC<ActivitySummaryProps> = ({ mileagePercent, strengthPercent }) => {
  return (
    <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto', bgcolor: 'background.paper', borderRadius: 2, p: 2, boxShadow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Activity Summary
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={6} alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
        <ProgressCircle percent={strengthPercent} color="#5B5BF6" label="Strength" />
        <ProgressCircle percent={mileagePercent} color="#14B8C4" label="Mileage" />
      </Stack>
    </Box>
  );
};

export default ActivitySummary; 