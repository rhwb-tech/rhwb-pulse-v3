import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert, Button, TextField, CircularProgress } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { supabase } from './supabaseClient';

interface AuthOTPVerificationProps {
  email: string;
  onBack: () => void;
  onSuccess: (session: any) => void;
}

const AuthOTPVerification: React.FC<AuthOTPVerificationProps> = ({ 
  email, 
  onBack, 
  onSuccess 
}) => {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [otpExpiryTime, setOtpExpiryTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Set initial OTP expiry time (10 minutes from now)
  useEffect(() => {
    setOtpExpiryTime(Date.now() + 10 * 60 * 1000);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!otpExpiryTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeRemaining = otpExpiryTime - now;

      if (timeRemaining <= 0) {
        setTimeLeft('Expired');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(timeRemaining / 60000);
      const seconds = Math.floor((timeRemaining % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [otpExpiryTime]);

  const handleOtpVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    if (!otpCode) {
      setError('Please enter the OTP code');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase(),
        token: otpCode,
        type: 'email'
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (data.session) {
        onSuccess(data.session);
      } else {
        setError('Invalid OTP code');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          data: {
            app: 'RHWB Pulse',
            app_domain: window.location.hostname,
            auth_method: 'otp'
          }
        }
      });

      if (error) {
        setError(error.message);
      } else {
        // Reset expiry time for new code (10 minutes)
        setOtpExpiryTime(Date.now() + 10 * 60 * 1000);
        setOtpCode('');
      }
    } catch (err) {
      setError('Failed to send new OTP code');
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtpCode(e.target.value);
    if (error) setError('');
  };

  const isExpired = timeLeft === 'Expired';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
        bgcolor: 'background.default'
      }}
    >
      <Box sx={{ maxWidth: 500, width: '100%' }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Enter OTP Code
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            We've sent a 6-digit code to <strong>{email}</strong>. 
            Enter the code below to sign in.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
            💡 You can also click the magic link in the same email to authenticate instantly.
          </Typography>
          {timeLeft && (
            <Typography 
              variant="body2" 
              color={isExpired ? 'error' : 'text.secondary'}
              sx={{ mb: 2, fontWeight: 'bold' }}
            >
              Time remaining: {timeLeft}
            </Typography>
          )}
          
          <Box component="form" onSubmit={handleOtpVerification} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="OTP Code"
              type="text"
              value={otpCode}
              onChange={handleOtpCodeChange}
              error={!!error}
              helperText={error}
              placeholder="Enter 6-digit code"
              inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
              sx={{ mb: 2 }}
              disabled={isExpired || isLoading}
            />
            <Button 
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mb: 2 }}
              disabled={isExpired || isLoading}
            >
              {isLoading ? <CircularProgress size={20} /> : 'Verify Code'}
            </Button>
            <Button 
              variant="outlined" 
              onClick={handleResendOtp}
              fullWidth
              disabled={isResending}
              sx={{ mb: 2 }}
            >
              {isResending ? <CircularProgress size={20} /> : 'Send New Code'}
            </Button>
            <Button 
              variant="text" 
              onClick={onBack}
              fullWidth
              startIcon={<ArrowBack />}
            >
              Back to Sign In
            </Button>
          </Box>
        </Alert>
      </Box>
    </Box>
  );
};

export default AuthOTPVerification;
