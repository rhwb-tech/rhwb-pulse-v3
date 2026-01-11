import React, { useEffect, useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';

interface CumulativeScoreProps {
  score: number;
  target?: number;
}

const CumulativeScore: React.FC<CumulativeScoreProps> = ({ score, target = 5 }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [animatedScore, setAnimatedScore] = useState(0);

  // Ensure score is a number
  const numericScore = typeof score === 'string' ? parseFloat(score) || 0 : score;
  const percentage = Math.min((numericScore / target) * 100, 100);

  // Animate score on mount/change
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = numericScore / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= numericScore) {
        setAnimatedScore(numericScore);
        clearInterval(timer);
      } else {
        setAnimatedScore(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [numericScore]);

  // Calculate color based on score
  const getScoreColor = () => {
    if (percentage >= 80) return { start: '#43E97B', end: '#38F9D7' }; // Green
    if (percentage >= 60) return { start: '#4FACFE', end: '#00F2FE' }; // Blue
    if (percentage >= 40) return { start: '#FFB347', end: '#FFCC33' }; // Orange
    return { start: '#FF6B9D', end: '#C449C2' }; // Pink
  };

  const colors = getScoreColor();

  // Responsive sizing
  const circleSize = isMobile ? 180 : 220;
  const strokeWidth = isMobile ? 12 : 14;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: 'background.paper',
        borderRadius: 3,
        p: { xs: 2.5, sm: 3 },
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: { xs: 320, sm: 360 },
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
        }
      }}
    >
      {/* Header */}
      <Box sx={{ mb: { xs: 2, sm: 3 }, textAlign: 'center', width: '100%' }}>
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
          Cumulative Score
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#666',
            fontSize: { xs: '0.75rem', sm: '0.8125rem' }
          }}
        >
          Overall performance rating
        </Typography>
      </Box>

      {/* Circular Progress */}
      <Box
        sx={{
          position: 'relative',
          width: circleSize,
          height: circleSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* SVG Circle */}
        <svg width={circleSize} height={circleSize} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="#f0f0f0"
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#glow)"
            style={{
              transition: 'stroke-dashoffset 1.5s ease-out',
            }}
          />
        </svg>

        {/* Center content */}
        <Box
          sx={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: '2.5rem', sm: '3.5rem' },
              fontWeight: 800,
              background: `linear-gradient(135deg, ${colors.start}, ${colors.end})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
              mb: 0.5
            }}
          >
            {animatedScore.toFixed(1)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: { xs: '0.7rem', sm: '0.8rem' },
              color: '#999',
              fontWeight: 600,
              letterSpacing: '0.05em'
            }}
          >
            OUT OF {target}
          </Typography>
        </Box>
      </Box>

    </Box>
  );
};

export default CumulativeScore; 