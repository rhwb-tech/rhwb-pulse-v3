import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { supabase } from './supabaseClient';

interface TrainingFeedbackProps {
  feedback: Array<{meso: string, qual: string}>;
  userEmail?: string;
  emailId?: string; // Add email_id from v_rhwb_meso_scores
}

const TrainingFeedback: React.FC<TrainingFeedbackProps> = ({ feedback, userEmail, emailId }) => {
  const [clickedIcons, setClickedIcons] = React.useState<Set<string>>(new Set());
  const [interactions, setInteractions] = React.useState<{[key: string]: {acknowledge: boolean, love: boolean}}>({});
  const isMobile = window.innerWidth <= 768;

  // Use emailId from v_rhwb_meso_scores if available, otherwise fall back to userEmail
  const currentEmail = emailId || userEmail;

  const handleIconClick = async (eventName: string, valueText: string, iconId: string, mesoCycle: string) => {
    if (!currentEmail) {
      return;
    }

    // Check if this interaction already exists
    const currentInteraction = interactions[mesoCycle];
    const isAcknowledge = valueText === 'Acknowledge';
    const isLove = valueText === 'Love';
    
    // Determine if we're undoing an existing interaction
    const isUndoing = (isAcknowledge && currentInteraction?.acknowledge) || 
                     (isLove && currentInteraction?.love);

    // Add animation effect
    setClickedIcons(prev => new Set(prev).add(iconId));
    
    // Remove animation after 500ms
    setTimeout(() => {
      setClickedIcons(prev => {
        const newSet = new Set(prev);
        newSet.delete(iconId);
        return newSet;
      });
    }, 500);

    try {
      if (isUndoing) {
        // Delete the existing interaction
        const { error } = await supabase
          .from('pulse_interactions')
          .delete()
          .eq('email_id', currentEmail)
          .eq('event_name', 'training feedback')
          .eq('value_text', valueText)
          .eq('value_label', mesoCycle);
        
        if (error) {
          // Error deleting training feedback interaction
        } else {
          // Log the removal action
          await supabase
            .from('pulse_interactions')
            .insert({
              email_id: currentEmail,
              event_name: 'training feedback removed',
              value_text: valueText,
              value_label: `${mesoCycle} - removed`
            });
          
          // Update local interactions state
          setInteractions(prev => ({
            ...prev,
            [mesoCycle]: {
              ...prev[mesoCycle],
              acknowledge: isAcknowledge ? false : prev[mesoCycle]?.acknowledge || false,
              love: isLove ? false : prev[mesoCycle]?.love || false
            }
          }));
        }
      } else {
        // Insert new interaction
        const { error } = await supabase
          .from('pulse_interactions')
          .insert({
            email_id: currentEmail,
            event_name: 'training feedback',
            value_text: valueText,
            value_label: mesoCycle
          });
        
        if (error) {
          // Error logging training feedback interaction
        } else {
          // Update local interactions state
          setInteractions(prev => ({
            ...prev,
            [mesoCycle]: {
              ...prev[mesoCycle],
              acknowledge: isAcknowledge ? true : prev[mesoCycle]?.acknowledge || false,
              love: isLove ? true : prev[mesoCycle]?.love || false
            }
          }));
        }
      }
    } catch (err) {
      // Error handling training feedback interaction
    }
  };

  if (!feedback || feedback.length === 0) {
    return (
      <Box sx={{ 
        width: '100%', 
        bgcolor: 'background.paper', 
        borderRadius: 2, 
        p: isMobile ? 2 : 3, 
        boxShadow: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: isMobile ? 150 : 200 
      }}>
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem',
            fontWeight: 600
          }}
        >
          Training Feedback
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          align="center"
          sx={{ fontSize: isMobile ? '14px' : '16px' }}
        >
          No training feedback available for this period.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          mb: isMobile ? 1 : 2, 
          fontWeight: 600,
          fontSize: isMobile ? '1.1rem' : '1.25rem'
        }}
      >
        Training Feedback
      </Typography>
      <Typography 
        variant="body2" 
        color="text.secondary" 
        sx={{ 
          mb: isMobile ? 2 : 3,
          fontSize: isMobile ? '14px' : '16px'
        }}
      >
        Review your coach's feedback for each mesocycle
      </Typography>
      
      <Box sx={{ flex: 1, overflowY: 'auto', pr: isMobile ? 0.5 : 1 }}>
        <Stack spacing={isMobile ? 1.5 : 2}>
          {feedback.map((item, index) => (
            <Card 
              key={item.meso} 
              sx={{ 
                border: index === 0 ? '2px solid #4caf50' : '2px solid #e0e0e0',
                borderRadius: 2,
                ml: isMobile ? 1 : 16,
                '&:hover': {
                  boxShadow: 2,
                }
              }}
            >
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: isMobile ? 1.5 : 2 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#333',
                    fontSize: isMobile ? '1rem' : '1.25rem'
                  }}
                >
                  {item.meso}
                </Typography>
                <Stack direction="row" spacing={isMobile ? 0.5 : 1}>
                  <Chip
                    icon={<ThumbUpIcon />}
                    label=""
                    size={isMobile ? "small" : "small"}
                    onClick={() => handleIconClick('training feedback', 'Acknowledge', `like-${item.meso}`, item.meso)}
                    title={interactions[item.meso]?.acknowledge ? "Remove acknowledgement" : "Acknowledge this feedback"}
                    sx={{ 
                      bgcolor: interactions[item.meso]?.acknowledge ? '#4caf50' : '#2196f3', 
                      color: 'white',
                      minWidth: isMobile ? 28 : 32,
                      height: isMobile ? 28 : 32,
                      cursor: 'pointer',
                      transform: clickedIcons.has(`like-${item.meso}`) ? 'scale(1.2)' : 'scale(1)',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        bgcolor: interactions[item.meso]?.acknowledge ? '#45a049' : '#1976d2',
                        transform: 'scale(1.05)',
                      },
                      '& .MuiChip-icon': { color: 'white' }
                    }}
                  />
                  <Chip
                    icon={<FavoriteIcon />}
                    label=""
                    size={isMobile ? "small" : "small"}
                    onClick={() => handleIconClick('training feedback', 'Love', `love-${item.meso}`, item.meso)}
                    title={interactions[item.meso]?.love ? "Remove love" : "Love this feedback"}
                    sx={{ 
                      bgcolor: interactions[item.meso]?.love ? '#4caf50' : '#f44336', 
                      color: 'white',
                      minWidth: isMobile ? 28 : 32,
                      height: isMobile ? 28 : 32,
                      cursor: 'pointer',
                      transform: clickedIcons.has(`love-${item.meso}`) ? 'scale(1.2)' : 'scale(1)',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        bgcolor: interactions[item.meso]?.love ? '#45a049' : '#d32f2f',
                        transform: 'scale(1.05)',
                      },
                      '& .MuiChip-icon': { color: 'white' }
                    }}
                  />
                </Stack>
              </Box>
              
              <Typography 
                variant="body1" 
                sx={{ 
                  lineHeight: 1.6, 
                  color: '#333',
                  fontSize: isMobile ? '14px' : '16px'
                }}
              >
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