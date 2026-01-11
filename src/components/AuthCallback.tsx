import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { supabase } from './supabaseClient';

const AuthCallback: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          setError(error.message);
          setIsLoading(false);
          return;
        }

        if (data.session) {
          // Successfully authenticated, redirect to main app
          window.location.href = '/';
        } else {
          console.error('No session found after authentication');
          setError('No session found after authentication');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error during authentication:', err);
        setError('An unexpected error occurred during authentication');
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, []);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Completing sign in...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we verify your authentication.
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 3,
          p: 3
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            Authentication Error
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
        
        <Typography variant="body2" color="text.secondary">
          Please try signing in again or contact support if the problem persists.
        </Typography>
      </Box>
    );
  }

  return null;
};

export default AuthCallback; 