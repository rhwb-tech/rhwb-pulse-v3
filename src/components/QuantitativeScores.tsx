import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Types for the data
export interface QuantitativeScoreData {
  meso: string;
  personal: number;
  coach: number;
  raceDistance: number;
}

interface QuantitativeScoresProps {
  data: QuantitativeScoreData[];
}

const COLORS = {
  coach: "#6366F1", // indigo
  personal: "#EC4899", // pink
  raceDistance: "#10B981", // emerald
};

const QuantitativeScores: React.FC<QuantitativeScoresProps> = ({ data }) => {
  const theme = useTheme();

  return (
    <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto', bgcolor: 'background.paper', borderRadius: 2, p: 2, boxShadow: 1, alignItems: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Quantitative Scores
      </Typography>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="meso" />
          <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
          <Tooltip />
          <Legend verticalAlign="top" height={36} />
          <Bar dataKey="coach" name="Coach" fill={COLORS.coach} radius={[4, 4, 0, 0]} />
          <Bar dataKey="personal" name="Personal" fill={COLORS.personal} radius={[4, 4, 0, 0]} />
          <Bar dataKey="raceDistance" name="Race Distance" fill={COLORS.raceDistance} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default QuantitativeScores; 