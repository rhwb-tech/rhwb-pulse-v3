import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Fade,
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import FlipCameraIosIcon from '@mui/icons-material/FlipCameraIos';
import LockIcon from '@mui/icons-material/Lock';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';

interface CameraCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageSrc: string) => void;
}

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  open,
  onClose,
  onCapture
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'https' | 'notSupported' | 'generic' | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorType(null);
    stopCamera();

    // Check if running on HTTPS or localhost
    const isSecure = window.location.protocol === 'https:' ||
                     window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1';

    if (!isSecure) {
      setError('Camera requires a secure connection (HTTPS). Please use HTTPS or access from localhost.');
      setErrorType('https');
      setIsLoading(false);
      return;
    }

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera is not supported on this browser. Please try a different browser.');
      setErrorType('notSupported');
      setIsLoading(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setIsLoading(false);

      // Handle specific error types
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please allow camera permission in your browser settings and try again.');
        setErrorType('permission');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
        setErrorType('notSupported');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another application. Please close other apps using the camera.');
        setErrorType('generic');
      } else if (err.name === 'OverconstrainedError') {
        // Try again without facing mode constraint
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
          }
          return;
        } catch {
          setError('Unable to access camera with current settings.');
          setErrorType('generic');
        }
      } else {
        setError('Unable to access camera. Please check your browser settings.');
        setErrorType('generic');
      }
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to video dimensions
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    // Calculate crop to center (square)
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;

    // Mirror image for front camera
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    // Draw cropped video frame
    ctx.drawImage(
      video,
      offsetX,
      offsetY,
      size,
      size,
      0,
      0,
      size,
      size
    );

    // Get data URL
    const imageSrc = canvas.toDataURL('image/jpeg', 0.9);

    stopCamera();
    onCapture(imageSrc);
  };

  const handleFlipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!open) return null;

  return (
    <Fade in={open}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        <Paper
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: 400,
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: '#fff'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              borderBottom: '1px solid #e0e0e0'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              Take a Selfie
            </Typography>
            <IconButton onClick={handleClose} size="small" sx={{ color: '#666' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Camera View */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: 320,
              bgcolor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isLoading && (
              <CircularProgress sx={{ color: 'white' }} />
            )}

            {error && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                px: 3,
                py: 2,
                textAlign: 'center'
              }}>
                {errorType === 'permission' && (
                  <LockIcon sx={{ fontSize: 48, color: '#ff9800', mb: 2 }} />
                )}
                {errorType === 'https' && (
                  <LockIcon sx={{ fontSize: 48, color: '#f44336', mb: 2 }} />
                )}
                {(errorType === 'notSupported' || errorType === 'generic') && (
                  <VideocamOffIcon sx={{ fontSize: 48, color: '#999', mb: 2 }} />
                )}
                <Typography sx={{ color: 'white', fontSize: '0.95rem', mb: 2 }}>
                  {error}
                </Typography>
                {errorType === 'permission' && (
                  <Alert severity="info" sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    '& .MuiAlert-icon': { color: '#90caf9' },
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}>
                    <strong>How to enable:</strong><br />
                    iOS Safari: Settings → Safari → Camera<br />
                    Android Chrome: Tap lock icon in address bar → Permissions
                  </Alert>
                )}
              </Box>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: isLoading || error ? 'none' : 'block',
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
              }}
            />

            {/* Circular overlay guide */}
            {!isLoading && !error && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  border: '3px solid rgba(255, 255, 255, 0.6)',
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 2000px rgba(0, 0, 0, 0.3)'
                }}
              />
            )}

            {/* Flip camera button */}
            {!isLoading && !error && (
              <IconButton
                onClick={handleFlipCamera}
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.3)'
                  }
                }}
              >
                <FlipCameraIosIcon />
              </IconButton>
            )}

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>

          {/* Action Buttons */}
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && errorType === 'permission' ? (
              <Button
                variant="contained"
                onClick={startCamera}
                fullWidth
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                  boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)'
                  }
                }}
              >
                Try Again
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleCapture}
                disabled={isLoading || !!error}
                fullWidth
                startIcon={<CameraAltIcon />}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
                  boxShadow: '0 4px 12px rgba(24, 119, 242, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0E5FD3 0%, #0A4EB0 100%)'
                  },
                  '&:disabled': {
                    background: '#ccc'
                  }
                }}
              >
                Capture Photo
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={handleClose}
              fullWidth
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: '#ddd',
                color: '#666',
                '&:hover': {
                  borderColor: '#999',
                  bgcolor: '#f5f5f5'
                }
              }}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
};

export default CameraCaptureModal;
