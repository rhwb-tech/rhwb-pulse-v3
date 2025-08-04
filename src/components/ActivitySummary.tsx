import React from 'react';
import { Box, Typography, Grid } from '@mui/material';

interface ActivitySummaryProps {
  activityData: {
    mileage: { percent: number | null; planned: number | null; completed: number | null };
    strength: { percent: number | null; planned: number | null; completed: number | null };
  };
}

function ProgressCircle({ percent, color, label, size = 120 }: { percent: number; color: string; label: string; size?: number }) {
  const isMobile = window.innerWidth <= 768;
  const strokeWidth = size * 0.08; // 8% of size
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(percent, 100));
  const offset = circumference * (1 - progress / 100);
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f0f0f0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: 'bold',
          color: '#333',
          textAlign: 'center'
        }}>
          {Math.round(progress)}%
        </Box>
      </Box>
      <Typography 
        variant="subtitle1" 
        color="#555" 
        sx={{ 
          mt: 1,
          mb: 0.5,
          fontSize: isMobile ? '14px' : '14px',
          fontWeight: 600,
          color: color,
          textAlign: 'center',
          lineHeight: 1.2
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// Info card component for displaying planned/completed values
const InfoCard = ({ title, value, color, bgColor }: { title: string; value: number | null; color: string; bgColor: string }) => {
  const isMobile = window.innerWidth <= 768;
  
  return (
    <Box sx={{
      backgroundColor: bgColor,
      borderRadius: '12px',
      padding: isMobile ? '16px' : '12px',
      flex: '1',
      minWidth: '0'
    }}>
      <Typography sx={{
        color: color,
        fontSize: isMobile ? '14px' : '14px',
        fontWeight: '600',
        mb: 1
      }}>
        {title}
      </Typography>
      <Typography sx={{
        fontSize: isMobile ? '2rem' : '2rem',
        fontWeight: 'bold',
        color: color,
        lineHeight: '1'
      }}>
        {value || 0}
      </Typography>
    </Box>
  );
};

const ActivitySummary: React.FC<ActivitySummaryProps> = ({ activityData }) => {
  const isMobile = window.innerWidth <= 768;
  const mileagePercent = activityData.mileage.percent || 0;
  const strengthPercent = activityData.strength.percent || 0;
  
  return (
    <Box sx={{ 
      width: '100%', 
      height: isMobile ? 400 : 350, 
      bgcolor: 'background.paper', 
      borderRadius: 2, 
      p: isMobile ? 1.5 : 2, 
      boxShadow: 1, 
      display: 'flex', 
      flexDirection: 'column'
    }}>
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          fontSize: isMobile ? '1.1rem' : '1.25rem',
          fontWeight: 600,
          mb: isMobile ? 2 : 3
        }}
      >
        Activity Summary
      </Typography>
      
      {/* Progress Circles */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        mb: isMobile ? 3 : 2,
        gap: isMobile ? '20px' : '10px'
      }}>
        <ProgressCircle 
          percent={strengthPercent} 
          color="#4285F4" 
          label="Strength % Completed"
          size={isMobile ? 100 : 90}
        />
        <ProgressCircle 
          percent={mileagePercent} 
          color="#9C27B0" 
          label="Mileage % Completed"
          size={isMobile ? 100 : 90}
        />
      </Box>

      {/* Info Cards */}
      <Grid container spacing={isMobile ? 1.5 : 1} sx={{ flex: 1 }}>
        <Grid item xs={6}>
          <InfoCard
            title="Strength Planned"
            value={activityData.strength.planned}
            color="#4285F4"
            bgColor="#f8f9ff"
          />
        </Grid>
        <Grid item xs={6}>
          <InfoCard
            title="Strength Completed"
            value={activityData.strength.completed}
            color="#34A853"
            bgColor="#f8fff9"
          />
        </Grid>
        <Grid item xs={6}>
          <InfoCard
            title="Mileage Planned"
            value={activityData.mileage.planned}
            color="#9C27B0"
            bgColor="#fdf8ff"
          />
        </Grid>
        <Grid item xs={6}>
          <InfoCard
            title="Mileage Completed"
            value={activityData.mileage.completed}
            color="#4285F4"
            bgColor="#f8f9ff"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ActivitySummary; 