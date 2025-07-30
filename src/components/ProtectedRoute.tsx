import React from 'react';
import { Box, CircularProgress, Typography, Alert, Button, TextField } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getAppConfig } from '../config/appConfig';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, logout, login, isEmailSent, clearEmailSent } = useAuth();
  const [email, setEmail] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const appConfig = getAppConfig();

  // Check if we're in override mode
  const urlParams = new URLSearchParams(window.location.search);
  const overrideEmail = urlParams.get('email');
  const isOverrideMode = !!overrideEmail;

  // Show loading spinner while checking authentication
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
          Loading...
        </Typography>
      </Box>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      
      if (!email) {
        setLoginError('Please enter your email address');
        return;
      }

      const result = await login(email);
      if (!result.success) {
        setLoginError(result.error || 'Failed to send magic link');
      }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      if (loginError) setLoginError('');
    };

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
        {isEmailSent ? (
          <Alert severity="success" sx={{ maxWidth: 500 }}>
            <Typography variant="h6" gutterBottom>
              Check Your Email
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              We've sent a magic link to <strong>{email}</strong>. 
              Click the link in your email to sign in.
            </Typography>
            <Button 
              variant="outlined" 
              onClick={clearEmailSent}
              sx={{ mt: 1 }}
            >
              Try Different Email
            </Button>
          </Alert>
        ) : (
          <Box sx={{ maxWidth: 400, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <img 
                src="/rhwb-pulse.ico" 
                alt="RHWB Pulse" 
                style={{ 
                  width: 32, 
                  height: 32, 
                  marginRight: 12,
                  borderRadius: '4px'
                }} 
              />
              <Typography variant="h4" gutterBottom align="center">
                {appConfig.appName}
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
              Sign in with your authorized email to access the dashboard
            </Typography>
            
            <Box component="form" onSubmit={handleLogin} sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={handleEmailChange}
                error={!!loginError}
                helperText={loginError}
                sx={{ mb: 3 }}
                placeholder="Enter your authorized email address"
              />
              
              <Button 
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mb: 2 }}
              >
                Send Magic Link
              </Button>
            </Box>
            
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Only authorized users can access this dashboard. 
              If you believe you should have access, please{' '}
              <a 
                href={`mailto:${appConfig.supportEmail}?subject=${appConfig.supportSubject}`}
                style={{ color: '#1976d2', textDecoration: 'underline' }}
              >
                send an email to RHWB Tech Team
              </a>.
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // Show user info and logout option
  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Header with user info and logout */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src="/rhwb-pulse.ico" 
            alt="RHWB Pulse" 
            style={{ 
              width: 24, 
              height: 24, 
              marginRight: 8,
              borderRadius: '3px'
            }} 
          />
          <Box>
            <Typography variant="h6" component="h1">
              {appConfig.appName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Welcome, {user?.name || user?.email} ({user?.role})
              {isOverrideMode && (
                <span style={{ color: '#f57c00', fontWeight: 'bold' }}>
                  {' '}(Override Mode)
                </span>
              )}
            </Typography>
          </Box>
        </Box>
        
        <Button 
          variant="outlined" 
          onClick={logout}
          size="small"
        >
          Sign Out
        </Button>
      </Box>
      
      {/* Main content */}
      <Box sx={{ p: 2 }}>
        {children}
      </Box>
    </Box>
  );
};

export default ProtectedRoute;