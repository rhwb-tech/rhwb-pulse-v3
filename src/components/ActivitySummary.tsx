import React from 'react';
import { Box, Typography, useTheme, Stack } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

interface ActivitySummaryProps {
  mileagePercent: number;
  strengthPercent: number;
}

const COLORS = ['#1976d2', '#43a047']; // Blue for Mileage, Green for Strength

const ActivitySummary: React.FC<ActivitySummaryProps> = ({ mileagePercent, strengthPercent }) => {
  const theme = useTheme();
  const data = [
    { name: 'Mileage', value: mileagePercent },
    { name: 'Strength', value: strengthPercent },
  ];
  return (
    <Box sx={{ width: '100%', height: 350, bgcolor: 'background.paper', borderRadius: 2, p: 2, boxShadow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Activity Summary
      </Typography>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={70}
            outerRadius={100}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}%`}
            paddingAngle={4}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Box display="flex" alignItems="center">
          <Box sx={{ width: 16, height: 16, bgcolor: COLORS[0], borderRadius: '50%', mr: 1 }} />
          <Typography variant="body2">Mileage</Typography>
        </Box>
        <Box display="flex" alignItems="center">
          <Box sx={{ width: 16, height: 16, bgcolor: COLORS[1], borderRadius: '50%', mr: 1 }} />
          <Typography variant="body2">Strength</Typography>
        </Box>
      </Stack>
    </Box>
  );
};

export default ActivitySummary; 