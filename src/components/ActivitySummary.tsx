import React, { useEffect, useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';

interface ActivitySummaryProps {
  activityData: {
    mileage: { percent: number | null; planned: number | null; completed: number | null };
    strength: { percent: number | null; planned: number | null; completed: number | null };
  };
}

// Modern gradient colors
const COLORS = {
  strength: {
    start: '#4FACFE',
    end: '#00F2FE'
  },
  mileage: {
    start: '#FF6B9D',
    end: '#C449C2'
  }
};

// Modern Progress Circle Component
function ProgressCircle({
  percent,
  gradientId,
  colors,
  label,
  icon,
  planned,
  completed,
  size = 140
}: {
  percent: number;
  gradientId: string;
  colors: { start: string; end: string };
  label: string;
  icon: React.ReactNode;
  planned: number | null;
  completed: number | null;
  size?: number;
}) {
  const [animatedPercent, setAnimatedPercent] = useState(0);

  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(percent, 100));
  const offset = circumference * (1 - animatedPercent / 100);

  // Animate percentage
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = progress / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= progress) {
        setAnimatedPercent(progress);
        clearInterval(timer);
      } else {
        setAnimatedPercent(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [progress]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      {/* Circular Progress */}
      <Box sx={{ position: 'relative', width: size, height: size, mb: 2 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
            <filter id={`glow-${gradientId}`}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f0f0f0"
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter={`url(#glow-${gradientId})`}
            style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
          />
        </svg>

        {/* Center content */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <Box sx={{ mb: 0.5 }}>
            {icon}
          </Box>
          <Typography sx={{
            fontSize: '1.75rem',
            fontWeight: 800,
            background: `linear-gradient(135deg, ${colors.start}, ${colors.end})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1
          }}>
            {Math.round(animatedPercent)}%
          </Typography>
        </Box>
      </Box>

      {/* Label */}
      <Typography
        variant="subtitle2"
        sx={{
          fontSize: { xs: '0.8rem', sm: '0.875rem' },
          fontWeight: 700,
          color: '#444',
          mb: 1.5,
          textAlign: 'center'
        }}
      >
        {label}
      </Typography>

      {/* Planned vs Completed */}
      <Box sx={{
        display: 'flex',
        gap: 1.5,
        width: '100%',
        justifyContent: 'center'
      }}>
        <Box sx={{
          textAlign: 'center',
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: `${colors.start}10`,
          border: `1px solid ${colors.start}30`,
          minWidth: 60
        }}>
          <Typography sx={{
            fontSize: '0.65rem',
            color: '#666',
            fontWeight: 600,
            mb: 0.3,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Plan
          </Typography>
          <Typography sx={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: colors.start
          }}>
            {planned || 0}
          </Typography>
        </Box>

        <Box sx={{
          textAlign: 'center',
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: `${colors.end}10`,
          border: `1px solid ${colors.end}30`,
          minWidth: 60
        }}>
          <Typography sx={{
            fontSize: '0.65rem',
            color: '#666',
            fontWeight: 600,
            mb: 0.3,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Done
          </Typography>
          <Typography sx={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: colors.end
          }}>
            {completed || 0}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

const ActivitySummary: React.FC<ActivitySummaryProps> = ({ activityData }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const mileagePercent = activityData.mileage.percent || 0;
  const strengthPercent = activityData.strength.percent || 0;

  return (
    <Box sx={{
      width: '100%',
      bgcolor: 'background.paper',
      borderRadius: 3,
      p: { xs: 2.5, sm: 3 },
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      border: '1px solid rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: { xs: 420, sm: 380 },
      transition: 'all 0.3s ease',
      '&:hover': {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
      }
    }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 2.5, sm: 3 }, textAlign: 'center' }}>
        <Typography
          variant="h6"
          sx={{
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5
          }}
        >
          Activity Summary
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#666',
            fontSize: { xs: '0.75rem', sm: '0.8125rem' }
          }}
        >
          Training completion progress
        </Typography>
      </Box>

      {/* Progress Circles */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: { xs: 3, sm: 2 },
        flex: 1
      }}>
        <ProgressCircle
          percent={strengthPercent}
          gradientId="strengthGradient"
          colors={COLORS.strength}
          label="Strength Completed"
          icon={
            <FitnessCenterIcon
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.75rem' },
                color: COLORS.strength.start
              }}
            />
          }
          planned={activityData.strength.planned}
          completed={activityData.strength.completed}
          size={isMobile ? 140 : 130}
        />

        <ProgressCircle
          percent={mileagePercent}
          gradientId="mileageGradient"
          colors={COLORS.mileage}
          label="Mileage Completed"
          icon={
            <DirectionsRunIcon
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.75rem' },
                color: COLORS.mileage.start
              }}
            />
          }
          planned={activityData.mileage.planned}
          completed={activityData.mileage.completed}
          size={isMobile ? 140 : 130}
        />
      </Box>
    </Box>
  );
};

export default ActivitySummary; 