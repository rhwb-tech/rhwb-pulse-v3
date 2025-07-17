import React from 'react';
import { Box, CircularProgress, Alert, Typography, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

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
          Authenticating...
        </Typography>
      </Box>
    );
  }

  // Show error if not authenticated
  if (!isAuthenticated) {
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
            Authentication Required
          </Typography>
          <Typography variant="body2">
            You need a valid JWT token to access this application. 
            Please ensure you're accessing this app through the proper Wix integration.
          </Typography>
        </Alert>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            If you have a token, you can add it to the URL:
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
            {window.location.origin}?token=YOUR_JWT_TOKEN
          </Typography>
        </Box>

        <Button 
          variant="outlined" 
          onClick={() => window.location.reload()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  // Show user info and logout option
  return (
    <Box>
      {/* Optional: Debug info in development */}
      {process.env.NODE_ENV === 'development' && user && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          right: 0, 
          bgcolor: 'rgba(0,0,0,0.8)', 
          color: 'white', 
          p: 1, 
          fontSize: 12,
          zIndex: 9999,
          borderRadius: '0 0 0 8px'
        }}>
          <div>User: {user.email}</div>
          <div>Role: {user.role}</div>
          <div>Exp: {new Date(user.exp * 1000).toLocaleString()}</div>
          <Button 
            size="small" 
            color="inherit" 
            onClick={logout}
            sx={{ fontSize: 10, mt: 0.5 }}
          >
            Logout
          </Button>
        </Box>
      )}
      
      {children}
    </Box>
  );
};

export default ProtectedRoute;