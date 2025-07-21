import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import FavoriteIcon from '@mui/icons-material/Favorite';
import StarIcon from '@mui/icons-material/Star';

interface TrainingFeedbackProps {
  feedback: Array<{meso: string, qual: string}>;
}

const TrainingFeedback: React.FC<TrainingFeedbackProps> = ({ feedback }) => {
  if (!feedback || feedback.length === 0) {
    return (
      <Box sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2, p: 3, boxShadow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <Typography variant="h6" gutterBottom>
          Training Feedback
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          No training feedback available for this period.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
        Training Feedback
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your coach's feedback for each mesocycle
      </Typography>
      
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
        <Stack spacing={2}>
          {feedback.map((item, index) => (
            <Card 
              key={item.meso} 
              sx={{ 
                border: index === 0 ? '2px solid #4caf50' : '2px solid #e0e0e0',
                borderRadius: 2,
                ml: 16,
                '&:hover': {
                  boxShadow: 2,
                }
              }}
            >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
                  {item.meso}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip
                    icon={<ThumbUpIcon />}
                    label=""
                    size="small"
                    sx={{ 
                      bgcolor: '#2196f3', 
                      color: 'white',
                      minWidth: 32,
                      '& .MuiChip-icon': { color: 'white' }
                    }}
                  />
                  <Chip
                    icon={<FavoriteIcon />}
                    label=""
                    size="small"
                    sx={{ 
                      bgcolor: '#f44336', 
                      color: 'white',
                      minWidth: 32,
                      '& .MuiChip-icon': { color: 'white' }
                    }}
                  />
                </Stack>
              </Box>
              
              <Typography variant="body1" sx={{ lineHeight: 1.6, color: '#333' }}>
                {item.qual}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  </Box>
  );
};

export default TrainingFeedback; 