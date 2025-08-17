import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { supabase } from './supabaseClient';

const AuthCallback: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Pulse AuthCallback: Starting authentication callback...');
        
        // Check if we have a hash in the URL (magic link)
        const hash = window.location.hash;
        console.log('Pulse AuthCallback: URL hash:', hash);
        
        // Check for access token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        
        console.log('Pulse AuthCallback: Access token in URL:', !!accessToken);
        console.log('Pulse AuthCallback: Refresh token in URL:', !!refreshToken);
        
        const { data, error } = await supabase.auth.getSession();
        
        console.log('Pulse AuthCallback: getSession result:', { 
          hasData: !!data, 
          hasSession: !!data?.session, 
          error: error?.message 
        });
        
        if (error) {
          console.error('Pulse AuthCallback: Session error:', error);
          setError(error.message);
          setIsLoading(false);
          return;
        }

        if (data.session) {
          console.log('Pulse AuthCallback: Session found, redirecting to main app...');
          // Successfully authenticated, redirect to main app
          window.location.href = '/';
        } else {
          console.error('Pulse AuthCallback: No session found after authentication');
          setError('No session found after authentication');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Pulse AuthCallback: Unexpected error:', err);
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