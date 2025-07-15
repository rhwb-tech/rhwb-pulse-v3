import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import ReactSpeedometer, { CustomSegmentLabelPosition } from 'react-d3-speedometer';

interface CumulativeScoreProps {
  score: number;
  target?: number;
}

const CumulativeScore: React.FC<CumulativeScoreProps> = ({ score, target = 5 }) => {
  const theme = useTheme();
  return (
    <Box sx={{ width: '100%', height: 350, bgcolor: 'background.paper', borderRadius: 2, p: 2, boxShadow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Cumulative Score
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 340, height: 240 }}>
        <ReactSpeedometer
          value={score}
          minValue={0}
          maxValue={target}
          segments={5}
          segmentColors={["#F3F4F6", "#C4B5FD", "#8B5CF6", "#7C3AED", "#5B21B6"]}
          needleColor={theme.palette.primary.main}
          textColor={theme.palette.text.primary}
          valueTextFontSize="32px"
          currentValueText="${value}"
          height={220}
          width={340}
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
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Target: {target}
      </Typography>
    </Box>
  );
};

export default CumulativeScore; 