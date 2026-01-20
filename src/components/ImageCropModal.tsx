import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import {
  Box,
  Button,
  Slider,
  Typography,
  Paper,
  Fade,
  IconButton,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { getCroppedImg, Area } from './utils/cropImage';

interface ImageCropModalProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  open,
  imageSrc,
  onClose,
  onCropComplete
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropCompleteHandler = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      setSaving(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 200);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Failed to crop image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      // Reset state when closing
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      onClose();
    }
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
          bgcolor: 'rgba(0, 0, 0, 0.8)',
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
              borderBottom: '1px solid #e0e0e0',
              bgcolor: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              Adjust Photo
            </Typography>
            <IconButton
              onClick={handleClose}
              disabled={saving}
              size="small"
              sx={{ color: '#666' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Crop Area */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: 300,
              bgcolor: '#000'
            }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteHandler}
            />
          </Box>

          {/* Zoom Slider */}
          <Box sx={{ px: 3, py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ZoomInIcon sx={{ color: '#666', fontSize: '1.2rem' }} />
              <Slider
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(_, value) => setZoom(value as number)}
                disabled={saving}
                sx={{
                  color: '#1877F2',
                  '& .MuiSlider-thumb': {
                    width: 20,
                    height: 20,
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: '0 0 0 8px rgba(24, 119, 242, 0.16)'
                    }
                  }
                }}
              />
              <Typography variant="caption" sx={{ color: '#666', minWidth: 40 }}>
                {zoom.toFixed(1)}x
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{ color: '#999', display: 'block', mt: 1, textAlign: 'center' }}
            >
              Drag to reposition, use slider to zoom
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              px: 3,
              pb: 3,
              pt: 1
            }}
          >
            <Button
              variant="outlined"
              onClick={handleClose}
              disabled={saving}
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
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !croppedAreaPixels}
              fullWidth
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
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
              {saving ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                'Save'
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
};

export default ImageCropModal;
