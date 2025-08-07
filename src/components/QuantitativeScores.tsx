import React from 'react';
import { Box, Typography, IconButton, Tooltip as MuiTooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
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
  coach: "#4285F4", // Google Blue
  personal: "#EA4335", // Google Red
  raceDistance: "#34A853", // Google Green
};

const QuantitativeScores: React.FC<QuantitativeScoresProps> = ({ data }) => {
  const isMobile = window.innerWidth <= 768;

  return (
    <Box sx={{ 
      width: '100%', 
      height: isMobile ? 350 : 400, 
      bgcolor: 'background.paper', 
      borderRadius: 2, 
      p: isMobile ? 1 : 2, 
      boxShadow: 1 
    }}>
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          fontSize: isMobile ? '1.1rem' : '1.25rem',
          fontWeight: 600,
          mb: isMobile ? 0.5 : 2
        }}
      >
        Quantitative Scores
      </Typography>
      <ResponsiveContainer width="100%" height={isMobile ? 270 : 320}>
        <BarChart 
          data={data} 
          margin={{ 
            top: isMobile ? 20 : 25, 
            right: isMobile ? 12 : 40, 
            left: isMobile ? 20 : 35, 
            bottom: isMobile ? 5 : 8 
          }}
          layout="vertical"
          barCategoryGap={isMobile ? "25%" : "30%"}
          barGap={isMobile ? 2 : 4}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={[0, 5]} 
            ticks={[0, 1, 2, 3, 4, 5]}
            allowDataOverflow={false}
            scale="linear"
          />
          <YAxis dataKey="meso" type="category" width={isMobile ? 20 : 30} />
          <Tooltip />
          <Legend 
            verticalAlign="bottom" 
            height={isMobile ? 90 : 100}
            content={({ payload }) => (
              <div style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: isMobile ? '6px' : '8px',
                marginTop: isMobile ? '10px' : '15px',
                marginLeft: isMobile ? '10px' : '15px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                  <div style={{ 
                    width: isMobile ? '10px' : '12px', 
                    height: isMobile ? '10px' : '12px', 
                    backgroundColor: COLORS.personal, 
                    borderRadius: '2px' 
                  }}></div>
                  <span style={{ fontSize: isMobile ? '12px' : '14px' }}>Personal</span>
                  <MuiTooltip title="Your Personal qualitative score this Meso cycle">
                    <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                  <div style={{ 
                    width: isMobile ? '10px' : '12px', 
                    height: isMobile ? '10px' : '12px', 
                    backgroundColor: COLORS.raceDistance, 
                    borderRadius: '2px' 
                  }}></div>
                  <span style={{ fontSize: isMobile ? '12px' : '14px' }}>Race Distance</span>
                  <MuiTooltip title="The average qualitative score of all runners registered for the same race distance">
                    <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                  <div style={{ 
                    width: isMobile ? '10px' : '12px', 
                    height: isMobile ? '10px' : '12px', 
                    backgroundColor: COLORS.coach, 
                    borderRadius: '2px' 
                  }}></div>
                  <span style={{ fontSize: isMobile ? '12px' : '14px' }}>Coach</span>
                  <MuiTooltip title="The average qualitative score of all runners under your coach">
                    <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </div>
              </div>
            )}
          />
          <Bar dataKey="personal" name="Personal" fill={COLORS.personal} radius={[0, 4, 4, 0]} barSize={isMobile ? 15 : 20}>
            <LabelList dataKey="personal" position="right" fontSize={isMobile ? 8 : 10} />
          </Bar>
          <Bar dataKey="raceDistance" name="Race Distance" fill={COLORS.raceDistance} radius={[0, 4, 4, 0]} barSize={isMobile ? 15 : 20}>
            <LabelList dataKey="raceDistance" position="right" fontSize={isMobile ? 8 : 10} />
          </Bar>
          <Bar dataKey="coach" name="Coach" fill={COLORS.coach} radius={[0, 4, 4, 0]} barSize={isMobile ? 15 : 20}>
            <LabelList dataKey="coach" position="right" fontSize={isMobile ? 8 : 10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default QuantitativeScores; 