import React from 'react';
import { Box, Typography, Card, CardContent, IconButton, Stack } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { supabase } from './supabaseClient';

interface TrainingFeedbackProps {
  feedback: Array<{meso: string, qual: string}>;
  userEmail?: string;
  emailId?: string;
}

const TrainingFeedback: React.FC<TrainingFeedbackProps> = ({ feedback, userEmail, emailId }) => {
  const [clickedIcons, setClickedIcons] = React.useState<Set<string>>(new Set());
  const [interactions, setInteractions] = React.useState<{[key: string]: {acknowledge: boolean, love: boolean}}>({});

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
        borderRadius: 3,
        p: { xs: 2.5, sm: 3 },
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: { xs: 180, sm: 220 },
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
        }
      }}>
        <Typography
          variant="h6"
          sx={{
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1
          }}
        >
          Training Feedback
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
        >
          No training feedback available for this period.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      width: '100%',
      bgcolor: 'background.paper',
      borderRadius: 3,
      p: { xs: 2.5, sm: 3 },
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      border: '1px solid rgba(0, 0, 0, 0.05)',
      transition: 'all 0.3s ease',
      '&:hover': {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
      }
    }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
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
          Training Feedback
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#666',
            fontSize: { xs: '0.75rem', sm: '0.8125rem' }
          }}
        >
          Review your coach's feedback for each mesocycle
        </Typography>
      </Box>

      {/* Feedback Cards */}
      <Stack spacing={{ xs: 2, sm: 2.5 }}>
        {feedback.map((item, index) => (
          <Card
            key={item.meso}
            sx={{
              background: 'rgba(255, 255, 255, 0.5)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 2.5,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                transform: 'translateY(-2px)'
              }
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              {/* Meso Title & Icons */}
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: { xs: 1.5, sm: 2 }
              }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {item.meso}
                </Typography>

                {/* Interaction Icons */}
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    onClick={() => handleIconClick('training feedback', 'Acknowledge', `like-${item.meso}`, item.meso)}
                    title={interactions[item.meso]?.acknowledge ? "Remove acknowledgement" : "Acknowledge this feedback"}
                    sx={{
                      width: { xs: 36, sm: 40 },
                      height: { xs: 36, sm: 40 },
                      background: interactions[item.meso]?.acknowledge
                        ? 'linear-gradient(135deg, #43E97B, #38F9D7)'
                        : 'linear-gradient(135deg, #4FACFE, #00F2FE)',
                      color: 'white',
                      boxShadow: interactions[item.meso]?.acknowledge
                        ? '0 4px 12px rgba(67, 233, 123, 0.3)'
                        : '0 4px 12px rgba(79, 172, 254, 0.3)',
                      transform: clickedIcons.has(`like-${item.meso}`) ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        boxShadow: interactions[item.meso]?.acknowledge
                          ? '0 6px 20px rgba(67, 233, 123, 0.4)'
                          : '0 6px 20px rgba(79, 172, 254, 0.4)',
                      }
                    }}
                  >
                    <ThumbUpIcon sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }} />
                  </IconButton>

                  <IconButton
                    size="small"
                    onClick={() => handleIconClick('training feedback', 'Love', `love-${item.meso}`, item.meso)}
                    title={interactions[item.meso]?.love ? "Remove love" : "Love this feedback"}
                    sx={{
                      width: { xs: 36, sm: 40 },
                      height: { xs: 36, sm: 40 },
                      background: interactions[item.meso]?.love
                        ? 'linear-gradient(135deg, #43E97B, #38F9D7)'
                        : 'linear-gradient(135deg, #FF6B9D, #C449C2)',
                      color: 'white',
                      boxShadow: interactions[item.meso]?.love
                        ? '0 4px 12px rgba(67, 233, 123, 0.3)'
                        : '0 4px 12px rgba(255, 107, 157, 0.3)',
                      transform: clickedIcons.has(`love-${item.meso}`) ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        boxShadow: interactions[item.meso]?.love
                          ? '0 6px 20px rgba(67, 233, 123, 0.4)'
                          : '0 6px 20px rgba(255, 107, 157, 0.4)',
                      }
                    }}
                  >
                    <FavoriteIcon sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }} />
                  </IconButton>
                </Stack>
              </Box>

              {/* Feedback Text */}
              <Typography
                variant="body1"
                sx={{
                  lineHeight: 1.7,
                  color: '#444',
                  fontSize: { xs: '0.85rem', sm: '0.9375rem' }
                }}
              >
                {item.qual}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};

export default TrainingFeedback; 