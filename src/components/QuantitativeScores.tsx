import React from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
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

// Modern gradient color schemes
const COLORS = {
  personal: {
    start: "#FF6B9D",
    end: "#C449C2",
    solid: "#E85AA3"
  },
  raceDistance: {
    start: "#4FACFE",
    end: "#00F2FE",
    solid: "#2DCFFF"
  },
  coach: {
    start: "#43E97B",
    end: "#38F9D7",
    solid: "#3EF1A9"
  }
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: 3,
          padding: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          minWidth: 200
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: '#1a1a1a',
            mb: 1.5,
            fontSize: { xs: '0.9rem', sm: '1rem' }
          }}
        >
          {label}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 0.75,
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${entry.fill}DD, ${entry.fill})`,
                  boxShadow: `0 2px 8px ${entry.fill}40`
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: '#666',
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  fontWeight: 500
                }}
              >
                {entry.name}
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: '#1a1a1a',
                fontSize: { xs: '0.85rem', sm: '0.9rem' }
              }}
            >
              {entry.value.toFixed(1)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }
  return null;
};

// Custom Legend Component
const CustomLegend = ({ payload }: any) => {
  const legendLabels: Record<string, string> = {
    Personal: "Your Score",
    "Race Distance": "Race Avg",
    Coach: "Coach Avg"
  };

  // Map data keys to solid colors
  const colorMap: Record<string, string> = {
    personal: COLORS.personal.solid,
    raceDistance: COLORS.raceDistance.solid,
    coach: COLORS.coach.solid
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: { xs: 1, sm: 1.5 },
        justifyContent: 'center',
        mt: { xs: 1.5, sm: 2 },
        px: 1
      }}
    >
      {payload?.map((entry: any, index: number) => {
        const solidColor = colorMap[entry.dataKey] || entry.color;
        return (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: { xs: 1.5, sm: 2 },
              py: { xs: 0.6, sm: 0.75 },
              borderRadius: 8,
              backgroundColor: `${solidColor}15`,
              border: `1.5px solid ${solidColor}30`,
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: `${solidColor}25`,
                transform: 'translateY(-1px)',
                boxShadow: `0 4px 12px ${solidColor}30`
              }
            }}
          >
            <Box
              sx={{
                width: { xs: 10, sm: 12 },
                height: { xs: 10, sm: 12 },
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${solidColor}, ${solidColor}DD)`,
                boxShadow: `0 2px 6px ${solidColor}50`
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                fontWeight: 600,
                color: '#444',
                letterSpacing: '0.01em'
              }}
            >
              {legendLabels[entry.value] || entry.value}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

const QuantitativeScores: React.FC<QuantitativeScoresProps> = ({ data }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: 'background.paper',
        borderRadius: 3,
        p: { xs: 2, sm: 3 },
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
        }
      }}
    >
      {/* Header */}
      <Box sx={{ mb: { xs: 2, sm: 3 } }}>
        <Typography
          variant="h5"
          sx={{
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5
          }}
        >
          Quantitative Scores
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#666',
            fontSize: { xs: '0.8rem', sm: '0.875rem' }
          }}
        >
          Performance metrics across meso cycles
        </Typography>
      </Box>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={isMobile ? 320 : 380}>
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: isMobile ? 20 : 30,
            left: isMobile ? -5 : 10,
            bottom: 10
          }}
          layout="vertical"
          barCategoryGap={isMobile ? "20%" : "25%"}
          barGap={isMobile ? 3 : 5}
        >
          <defs>
            {/* Gradient definitions for each bar */}
            <linearGradient id="personalGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={COLORS.personal.start} />
              <stop offset="100%" stopColor={COLORS.personal.end} />
            </linearGradient>
            <linearGradient id="raceDistanceGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={COLORS.raceDistance.start} />
              <stop offset="100%" stopColor={COLORS.raceDistance.end} />
            </linearGradient>
            <linearGradient id="coachGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={COLORS.coach.start} />
              <stop offset="100%" stopColor={COLORS.coach.end} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e0e0e0"
            strokeOpacity={0.3}
            vertical={false}
          />

          <XAxis
            type="number"
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            stroke="#999"
            style={{
              fontSize: isMobile ? '0.75rem' : '0.8125rem',
              fontWeight: 500
            }}
            tick={{ fill: '#666' }}
          />

          <YAxis
            dataKey="meso"
            type="category"
            width={isMobile ? 45 : 55}
            stroke="#999"
            style={{
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: 600
            }}
            tick={{ fill: '#444' }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }} />

          <Legend
            content={<CustomLegend />}
            wrapperStyle={{ paddingTop: '10px' }}
          />

          {/* Bars with gradients and animations */}
          <Bar
            dataKey="personal"
            name="Personal"
            fill="url(#personalGradient)"
            radius={[0, 8, 8, 0]}
            barSize={isMobile ? 18 : 22}
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          />

          <Bar
            dataKey="raceDistance"
            name="Race Distance"
            fill="url(#raceDistanceGradient)"
            radius={[0, 8, 8, 0]}
            barSize={isMobile ? 18 : 22}
            animationBegin={200}
            animationDuration={800}
            animationEasing="ease-out"
          />

          <Bar
            dataKey="coach"
            name="Coach"
            fill="url(#coachGradient)"
            radius={[0, 8, 8, 0]}
            barSize={isMobile ? 18 : 22}
            animationBegin={400}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default QuantitativeScores; 