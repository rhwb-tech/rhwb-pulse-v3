import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import ReactSpeedometer, { CustomSegmentLabelPosition } from 'react-d3-speedometer';

interface CumulativeScoreProps {
  score: number;
  target?: number;
}

const CumulativeScore: React.FC<CumulativeScoreProps> = ({ score, target = 5 }) => {
  const theme = useTheme();
  const isMobile = window.innerWidth <= 768;
  
  // Ensure score is a number
  const numericScore = typeof score === 'string' ? parseFloat(score) || 0 : score;
  
  // Responsive dimensions
  const gaugeWidth = isMobile ? 260 : 340;
  const gaugeHeight = isMobile ? 160 : 220;
  const fontSize = isMobile ? "20px" : "28px";
  
  return (
    <Box sx={{ 
      width: '100%', 
      height: isMobile ? 320 : 350, 
      bgcolor: 'background.paper', 
      borderRadius: 2, 
      p: isMobile ? 1.5 : 2, 
      boxShadow: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          fontSize: isMobile ? '1.1rem' : '1.25rem',
          fontWeight: 600,
          mb: isMobile ? 1 : 2
        }}
      >
        Cumulative Score
      </Typography>
      <Box sx={{ 
        width: '100%', 
        maxWidth: gaugeWidth, 
        height: gaugeHeight + (isMobile ? 10 : 20),
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ReactSpeedometer
          value={numericScore}
          minValue={0}
          maxValue={target}
          segments={5}
          segmentColors={["#F3F4F6", "#C4B5FD", "#8B5CF6", "#7C3AED", "#5B21B6"]}
          needleColor={theme.palette.primary.main}
          textColor={theme.palette.text.primary}
          valueTextFontSize={fontSize}
          currentValueText={String(numericScore)}
          height={gaugeHeight}
          width={gaugeWidth}
          customSegmentLabels={[
            { text: '1', position: CustomSegmentLabelPosition.Inside, color: theme.palette.text.secondary },
            { text: '2', position: CustomSegmentLabelPosition.Inside, color: theme.palette.text.secondary },
            { text: '3', position: CustomSegmentLabelPosition.Inside, color: theme.palette.text.secondary },
            { text: '4', position: CustomSegmentLabelPosition.Inside, color: theme.palette.text.secondary },
            { text: '5', position: CustomSegmentLabelPosition.Inside, color: theme.palette.text.secondary },
          ]}
          forceRender={true}
        />
      </Box>
      <Typography 
        variant="body2" 
        color="text.secondary" 
        sx={{ 
          mt: isMobile ? 0.5 : 1,
          fontSize: isMobile ? '14px' : '16px'
        }}
      >
        Target: {target}
      </Typography>
    </Box>
  );
};

export default CumulativeScore; 