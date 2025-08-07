import React from 'react';
import { Box, Typography, useTheme, IconButton, Tooltip as MuiTooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label, LabelList,
} from 'recharts';

// Types for the data
export interface QuantitativeScoreMobileData {
  meso: string;
  personal: number;
  coach: number;
  raceDistance: number;
}

interface QuantitativeScoresMobileProps {
  data: QuantitativeScoreMobileData[];
}

const COLORS = {
  coach: "#4285F4", // Google Blue
  personal: "#EA4335", // Google Red
  raceDistance: "#34A853", // Google Green
};

const QuantitativeScoresMobile: React.FC<QuantitativeScoresMobileProps> = ({ data }) => {
  const theme = useTheme();

  return (
    <Box sx={{ width: '100%', height: 350, bgcolor: 'background.paper', borderRadius: 2, p: 2, boxShadow: 1 }}>
      <Typography variant="h6" gutterBottom>
        Quantitative Score Mobile
      </Typography>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart 
          data={data} 
          margin={{ top: 40, right: 44, left: 50, bottom: 8 }}
          layout="vertical"
          barCategoryGap="30%"
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={[0, 5]} 
            ticks={[0, 1, 2, 3, 4, 5]}
            allowDataOverflow={false}
            scale="linear"
          />
          <YAxis dataKey="meso" type="category" width={60}/>
          <Tooltip />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            content={({ payload }) => (
              <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: COLORS.personal, borderRadius: '2px' }}></div>
                  <span>Personal</span>
                  <MuiTooltip title="Your Personal quantitative score this Meso cycle">
                    <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: COLORS.raceDistance, borderRadius: '2px' }}></div>
                  <span>Race Distance</span>
                  <MuiTooltip title="The average quantitative score of all runners registered for the same race distance">
                    <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: COLORS.coach, borderRadius: '2px' }}></div>
                  <span>Coach</span>
                  <MuiTooltip title="The average quantitative score of all runners under your coach">
                    <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </li>
              </ul>
            )}
          />
          <Bar dataKey="personal" name="Personal" fill={COLORS.personal} radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList dataKey="personal" position="right" />
          </Bar>
          <Bar dataKey="raceDistance" name="Race Distance" fill={COLORS.raceDistance} radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList dataKey="raceDistance" position="right" />
          </Bar>
          <Bar dataKey="coach" name="Coach" fill={COLORS.coach} radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList dataKey="coach" position="right" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default QuantitativeScoresMobile; 