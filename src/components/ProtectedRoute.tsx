import React from 'react';
import { Box, CircularProgress, Typography, Alert, Button, TextField, IconButton, Menu, MenuItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Avatar } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import { Key } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getAppConfig } from '../config/appConfig';
import AuthOTPVerification from './AuthOTPVerification';
import CertificateGenerator from '../CertificateGeneratorSimple';
import { supabase } from './supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import GeminiChatBot from './GeminiChatBot';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, logout, login, isEmailSent, clearEmailSent, session } = useAuth();
  const { selectedRunner, userRole, hybridToggle, setOverrideEmail, setAuthenticatedEmail, overrideEmail, isOverrideActive } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  // Remove authMethod state since we only have OTP now
  const [showOTPVerification, setShowOTPVerification] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const [overrideError, setOverrideError] = React.useState<string | null>(null);
  const appConfig = getAppConfig();
  
  // Parse email_id from URL parameters
  const urlParams = new URLSearchParams(location.search);
  const emailIdFromUrl = urlParams.get('email_id');
  
  // Track if we've processed the current URL override
  const processedOverrideRef = React.useRef<string | null>(null);

  // Detect timeout scenario: session exists but no user and not loading
  React.useEffect(() => {
    if (session && !user && !isLoading) {
      // This indicates a validation timeout scenario
      // Use a longer timeout (8 seconds) to account for async state updates
      // and give validation time to complete and set user state
      // This is longer than the validation timeout (15s for session restore) to allow for retries
      const timer = setTimeout(() => {
        // Double-check that user is still null before showing timeout
        // This prevents race conditions where user state is being set
        if (session && !user && !isLoading) {
          console.log('[PROTECTED ROUTE] Timeout detected - session exists but no user after 8 seconds');
          setLoadingTimeout(true);
        }
      }, 8000); // Wait 8 seconds to confirm it's stuck (longer than validation timeout + retries)

      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [session, user, isLoading]);

  // Handle email override from URL parameter
  React.useEffect(() => {
    // Only process when user is authenticated
    if (!isAuthenticated || !user) {
      return;
    }

    // Set the authenticated email in AppContext
    setAuthenticatedEmail(user.email);

    // Check if there's an email_id in the URL
    if (emailIdFromUrl) {
      const normalizedOverrideEmail = emailIdFromUrl.toLowerCase().trim();
      
      // Skip if we've already processed this override
      if (processedOverrideRef.current === normalizedOverrideEmail) {
        return;
      }

      console.log('[PROTECTED ROUTE] Email override requested:', normalizedOverrideEmail);
      console.log('[PROTECTED ROUTE] Authenticated user role:', user.role);

      // Check if user has admin role
      if (user.role !== 'admin') {
        console.log('[PROTECTED ROUTE] Override rejected - user is not admin');
        setOverrideError('Email override is only allowed for admin users.');
        setOverrideEmail(null);
        processedOverrideRef.current = normalizedOverrideEmail;
        return;
      }

      // Admin user - allow override
      console.log('[PROTECTED ROUTE] Override approved for admin user');
      setOverrideEmail(normalizedOverrideEmail);
      setOverrideError(null);
      processedOverrideRef.current = normalizedOverrideEmail;
    } else {
      // No override in URL - clear any existing override
      if (overrideEmail) {
        console.log('[PROTECTED ROUTE] Clearing email override');
        setOverrideEmail(null);
        processedOverrideRef.current = null;
      }
    }
  }, [isAuthenticated, user, emailIdFromUrl, setAuthenticatedEmail, setOverrideEmail, overrideEmail]);

  // Hamburger menu state (moved to header)
  const [hamburgerMenuAnchor, setHamburgerMenuAnchor] = React.useState<null | HTMLElement>(null);
  const hamburgerMenuOpen = Boolean(hamburgerMenuAnchor);
  const handleHamburgerMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setHamburgerMenuAnchor(event.currentTarget);
  };
  const handleHamburgerMenuClose = () => {
    setHamburgerMenuAnchor(null);
  };
  
  // Certificate dialog state
  const [certificateDialogOpen, setCertificateDialogOpen] = React.useState(false);
  const [runnerData, setRunnerData] = React.useState<any>(null);
  const [loadingRunnerData, setLoadingRunnerData] = React.useState(false);
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');
  
  const handleCertificatesClick = () => {
    // Placeholder: wire up navigation/action here
    // e.g., navigate('/certificates')
    setHamburgerMenuAnchor(null);
  };
  const handleSeason14Click = async () => {
    // Determine which email to use for certificate generation
    // For hybrid users in 'myScore' mode, use their own email (like runners)
    // For hybrid users in 'myCohorts' mode, they need to select a runner (like coaches)
    const isNonRunnerRole = userRole === 'coach' || userRole === 'admin' || (userRole === 'hybrid' && hybridToggle === 'myCohorts');

    // For coach/admin/hybrid in cohorts mode, check if a runner is selected
    if (isNonRunnerRole && !selectedRunner) {
      setSnackbarMessage('Please select a runner from the dashboard before generating a certificate.');
      setSnackbarOpen(true);
      setHamburgerMenuAnchor(null);
      return;
    }

    // Use selectedRunner email if available (for coach/admin/hybrid in cohorts mode),
    // otherwise use logged-in user's email (for runner or hybrid in myScore mode)
    const targetEmail = (isNonRunnerRole && selectedRunner) ? selectedRunner : (user?.email || '');
    
    if (!targetEmail) {
      console.error('No email available for certificate generation');
      setSnackbarMessage('Unable to generate certificate: No email address found.');
      setSnackbarOpen(true);
      setHamburgerMenuAnchor(null);
      return;
    }
    
    // Fetch runner data from database
    setLoadingRunnerData(true);
    try {
      // Fetch runner profile data
      const { data: profileData, error: profileError } = await supabase
        .from('runners_profile')
        .select('runner_name')
        .eq('email_id', targetEmail.toLowerCase())
        .single();
      
      if (profileError) {
        console.error('Error fetching runner profile:', profileError);
        throw profileError;
      }
      
      // Fetch runner season info
      const { data: seasonData, error: seasonError } = await supabase
        .from('runner_season_info')
        .select('race_timings, race_distance_completed, coach, race_pr')
        .eq('email_id', targetEmail.toLowerCase())
        .eq('season', 'Season 14')
        .single();
      
      if (seasonError) {
        console.error('Error fetching season info:', seasonError);
        throw seasonError;
      }
      
      // Combine the data
      const combinedRunnerData = {
        id: targetEmail,
        name: profileData?.runner_name || targetEmail.split('@')[0] || 'Runner',
        race: seasonData?.race_distance_completed || null, // Leave blank if not available
        time: seasonData?.race_timings || null, // Keep null if not available
        coach: seasonData?.coach || null, // Leave blank if not available
        race_pr: seasonData?.race_pr || false,
        date: new Date().toLocaleDateString()
      };

      setRunnerData(combinedRunnerData);
      setCertificateDialogOpen(true);
      
    } catch (error) {
      console.error('Error fetching runner data:', error);
      // Fallback to basic data if database fetch fails
      const fallbackData = {
        id: targetEmail,
        name: targetEmail.split('@')[0] || 'Runner',
        race: null, // Leave blank if not available
        time: null, // Set to null to show informational message
        coach: null, // Leave blank if not available
        race_pr: false,
        date: new Date().toLocaleDateString()
      };
      setRunnerData(fallbackData);
      setCertificateDialogOpen(true);
    } finally {
      setLoadingRunnerData(false);
    }
    
    setHamburgerMenuAnchor(null);
  };
  
  const handleCloseCertificateDialog = () => {
    setCertificateDialogOpen(false);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  // OTP handler functions
  const handleOTPSuccess = (session: Session | null, isPublicLaptop?: boolean) => {
    // OTP verification successful, user will be automatically logged in
    // The public laptop flag is already handled in AuthOTPVerification component
    setShowOTPVerification(false);
  };

  const handleOTPBack = () => {
    setShowOTPVerification(false);
    clearEmailSent();
  };

  // Show loading spinner while checking authentication
  if (isLoading || loadingTimeout) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          px: 3
        }}
      >
        {loadingTimeout ? (
          <>
            <Alert severity="warning" sx={{ maxWidth: 500 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                Connection Timeout
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                We're having trouble connecting to the authentication server. This could be due to a slow internet connection or temporary server issue.
              </Typography>
            </Alert>
            <Button
              variant="contained"
              onClick={() => window.location.reload()}
              sx={{
                background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0E5FD3 0%, #0A4EB0 100%)',
                }
              }}
            >
              Retry Connection
            </Button>
            <Button
              variant="outlined"
              onClick={logout}
              sx={{ mt: 1 }}
            >
              Sign Out
            </Button>
          </>
        ) : (
          <>
            <CircularProgress size={60} />
            <Typography variant="h6" color="text.secondary">
              Loading...
            </Typography>
          </>
        )}
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
          {/* Hamburger to the left of the logo */}
          <IconButton
            onClick={handleHamburgerMenuOpen}
            sx={{
              color: 'primary.main',
              mr: 1,
              '&:hover': {
                backgroundColor: '#e3f2fd',
              },
            }}
            aria-label="Open menu"
          >
            <MenuIcon />
          </IconButton>

          <Menu
            anchorEl={hamburgerMenuAnchor}
            open={hamburgerMenuOpen}
            onClose={handleHamburgerMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 200,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                borderRadius: 2,
                border: '1px solid #e0e0e0',
              }
            }}
          >
            <MenuItem
              onClick={() => {
                navigate('/profile');
                handleHamburgerMenuClose();
              }}
              sx={{
                minHeight: 40,
                '&:hover': {
                  bgcolor: '#f5f5f5',
                },
              }}
            >
              <ListItemText primary="Profile" />
            </MenuItem>
            <MenuItem
              onClick={handleCertificatesClick}
              sx={{
                minHeight: 40,
                '&:hover': {
                  bgcolor: '#f5f5f5',
                },
              }}
            >
              <ListItemText primary="Certificates" />
            </MenuItem>
            <MenuItem
              onClick={handleSeason14Click}
              sx={{
                minHeight: 40,
                pl: 3,
                '&:hover': {
                  bgcolor: '#f5f5f5',
                },
              }}
            >
              <ListItemText primary="Season 14" />
            </MenuItem>
          </Menu>

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
              {isOverrideActive && (
                <span style={{ color: '#f57c00', fontWeight: 'bold' }}>
                  {' '}(Viewing: {overrideEmail})
                </span>
              )}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Profile Avatar */}
          <IconButton
            onClick={handleProfileClick}
            sx={{
              p: 0,
              '&:hover': {
                transform: 'scale(1.05)',
                transition: 'transform 0.2s'
              }
            }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
                }
              }}
            >
              <PersonIcon />
            </Avatar>
          </IconButton>

          {/* Sign Out Button */}
          <Button
            variant="outlined"
            onClick={logout}
            size="small"
          >
            Sign Out
          </Button>
        </Box>
      </Box>
      
      {/* Override Error Alert */}
      {overrideError && (
        <Alert 
          severity="error" 
          sx={{ mx: 2, mt: 2 }}
          onClose={() => setOverrideError(null)}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Access Denied
          </Typography>
          <Typography variant="body2">
            {overrideError}
          </Typography>
        </Alert>
      )}

      {/* Override Active Banner */}
      {isOverrideActive && !overrideError && (
        <Alert 
          severity="info" 
          sx={{ mx: 2, mt: 2 }}
        >
          <Typography variant="body2">
            <strong>Override Mode Active:</strong> You are viewing data for <strong>{overrideEmail}</strong>. 
            {' '}
            <Button 
              size="small" 
              variant="text" 
              onClick={() => {
                // Remove email_id from URL and navigate
                const params = new URLSearchParams(location.search);
                params.delete('email_id');
                const newSearch = params.toString();
                navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
              }}
              sx={{ ml: 1, textTransform: 'none' }}
            >
              Exit Override Mode
            </Button>
          </Typography>
        </Alert>
      )}

      {/* Main content */}
      <Box sx={{ p: 2 }}>
        {children}
      </Box>
      
      {/* Certificate Generator Dialog */}
      <Dialog 
        open={certificateDialogOpen} 
        onClose={handleCloseCertificateDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Generate Season 14 Certificate
        </DialogTitle>
        <DialogContent>
          {loadingRunnerData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Loading runner data...</Typography>
            </Box>
          ) : runnerData ? (
            <CertificateGenerator 
              runner={runnerData}
            />
          ) : (
            <Typography>No runner data available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCertificateDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for friendly messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="info" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Gemini AI Chatbot - Admin only */}
      {user?.role === 'admin' && <GeminiChatBot />}
    </Box>
  );
};

export default ProtectedRoute;
