import React from 'react';
import { Box, CircularProgress, Typography, Alert, Button, TextField } from '@mui/material';
import { Key } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getAppConfig } from '../config/appConfig';
import AuthOTPVerification from './AuthOTPVerification';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, logout, login, isEmailSent, clearEmailSent } = useAuth();
  const [email, setEmail] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  // Remove authMethod state since we only have OTP now
  const [showOTPVerification, setShowOTPVerification] = React.useState(false);
  const appConfig = getAppConfig();

  // OTP handler functions
  const handleOTPSuccess = (session: any) => {
    // OTP verification successful, user will be automatically logged in
    setShowOTPVerification(false);
  };

  const handleOTPBack = () => {
    setShowOTPVerification(false);
    clearEmailSent();
  };

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

  // Show OTP verification if needed
  if (showOTPVerification) {
    return (
      <AuthOTPVerification
        email={email}
        onBack={handleOTPBack}
        onSuccess={handleOTPSuccess}
      />
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
        setLoginError(result.error || 'Failed to send OTP');
      } else {
        // Show OTP verification screen
        setShowOTPVerification(true);
      }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      if (loginError) setLoginError('');
    };

    // Remove handleAuthMethodChange since we only have OTP now

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
              We've sent a 6-digit code to <strong>{email}</strong>. 
              Enter the code on the next screen to sign in.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
              If you have trouble connecting, restart your browser session and try. If you are still having trouble please send an email to{' '}
              <a 
                href="mailto:techteamrhwb@gmail.com"
                style={{ color: '#1976d2', textDecoration: 'underline' }}
              >
                techteamrhwb@gmail.com
              </a>
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
                  width: 48, 
                  height: 48, 
                  marginRight: 16,
                  borderRadius: '6px'
                }} 
              />
              <Typography variant="h4" gutterBottom align="center" sx={{ fontWeight: 600 }}>
                {appConfig.appName}
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
              Sign in with your authorized email to access the dashboard
            </Typography>

            {/* OTP Authentication Info */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <Key sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                <Typography variant="subtitle2">
                  OTP Authentication
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" align="center" display="block">
                We'll send you a 6-digit code to enter on the next screen
              </Typography>
            </Box>
            
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
                Send OTP Code
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
              width: 40, 
              height: 40, 
              marginRight: 12,
              borderRadius: '4px'
            }} 
          />
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
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