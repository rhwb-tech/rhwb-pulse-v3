import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button,
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Grid,
  Card,
  IconButton,
  Container,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import CakeIcon from '@mui/icons-material/Cake';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import TimelineIcon from '@mui/icons-material/Timeline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsIcon from '@mui/icons-material/Sports';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { supabase, supabaseValidation } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import ImageCropModal from './ImageCropModal';
import CameraCaptureModal from './CameraCaptureModal';

interface RunnerProfile {
  email_id: string;
  runner_name: string;
  gender: string;
  address: string;
  zip: string;
  city: string;
  state: string;
  country: string;
  phone_no: string;
  dob: string;
  referred_by: string | null;
  referred_by_email_id: string | null;
  profile_picture: string | null;
}

interface TimelineEntry {
  season: string;
  race_distance: string | null;
  coach: string | null;
  coach_picture: string | null;
  coach_profile_url: string | null;
}

// Helper function to get initials from a name
const getInitials = (name: string | null): string => {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};


const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const { effectiveEmail, isOverrideActive, overrideEmail } = useApp();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<RunnerProfile | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [referredByValue, setReferredByValue] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle avatar click to show photo source menu
  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isOverrideActive && !uploading) {
      setMenuAnchorEl(event.currentTarget);
    }
  };

  // Close the photo source menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // Handle selecting "Upload Photo" from menu
  const handleUploadOption = () => {
    handleMenuClose();
    fileInputRef.current?.click();
  };

  // Handle selecting "Take Photo" from menu
  const handleCameraOption = () => {
    handleMenuClose();
    setShowCameraModal(true);
  };

  // Handle camera capture - opens crop modal with captured image
  const handleCameraCapture = (imageSrc: string) => {
    setShowCameraModal(false);
    setSelectedImageSrc(imageSrc);
    setShowCropModal(true);
  };

  // Use effectiveEmail (which respects override) for profile data
  const targetEmail = effectiveEmail || user?.email || '';

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const userRole = user?.role;
      console.log('[PROFILE] Starting profile fetch for:', targetEmail, 'role:', userRole);
      if (isOverrideActive) {
        console.log('[PROFILE] Override mode active - fetching profile for:', overrideEmail);
      }

      // Add timeout protection (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile query timeout')), 10000);
      });

      const startTime = Date.now();

      // Always fetch personal details from runners_profile
      console.log('[PROFILE] Fetching personal details from runners_profile...');
      const profileQuery = supabaseValidation
        .from('runners_profile')
        .select('email_id, runner_name, gender, address, zip, city, state, country, phone_no, dob, referred_by, referred_by_email_id, profile_picture')
        .eq('email_id', targetEmail.toLowerCase())
        .single();

      const { data: profileData, error: profileError } = await Promise.race([
        profileQuery,
        timeoutPromise
      ]).catch((err) => {
        console.error('[PROFILE] Profile query failed or timed out:', err);
        return { data: null, error: err };
      }) as { data: RunnerProfile | null; error: any };

      const profileElapsed = Date.now() - startTime;
      console.log(`[PROFILE] runners_profile query completed in ${profileElapsed}ms`);

      if (profileError) {
        console.error('[PROFILE] Error fetching from runners_profile:', profileError);
      }

      // For non-runner roles, also fetch profile picture from role-specific table
      let roleProfilePicture: string | null = null;
      if (userRole === 'admin' || userRole === 'coach' || userRole === 'hybrid') {
        const roleTable = userRole === 'admin' ? 'rhwb_admin' : 'rhwb_coaches';
        const selectField = userRole === 'admin' ? 'profile_picture' : 'profile_picture';

        console.log(`[PROFILE] Fetching profile picture from ${roleTable}...`);
        const roleStartTime = Date.now();

        const { data: roleData, error: roleError } = await supabaseValidation
          .from(roleTable)
          .select(selectField)
          .eq('email_id', targetEmail.toLowerCase())
          .single();

        const roleElapsed = Date.now() - roleStartTime;
        console.log(`[PROFILE] ${roleTable} query completed in ${roleElapsed}ms`);

        if (!roleError && roleData) {
          roleProfilePicture = roleData.profile_picture;
          console.log(`[PROFILE] Profile picture from ${roleTable}:`, roleProfilePicture);
        } else if (roleError) {
          console.log(`[PROFILE] No record in ${roleTable} for this user, using runners_profile picture`);
        }
      }

      // Build final profile data
      const finalProfileData: RunnerProfile = profileData || {
        email_id: targetEmail,
        runner_name: '',
        gender: '',
        address: '',
        zip: '',
        city: '',
        state: '',
        country: '',
        phone_no: '',
        dob: '',
        referred_by: null,
        referred_by_email_id: null,
        profile_picture: null
      };

      // Override profile picture with role-specific one if available
      if (roleProfilePicture) {
        finalProfileData.profile_picture = roleProfilePicture;
      }

      console.log('Final profile data:', finalProfileData);
      console.log('Profile picture URL:', finalProfileData.profile_picture);
      setProfileData(finalProfileData);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, [targetEmail, isOverrideActive, overrideEmail, user?.role]);

  const fetchTimelineData = useCallback(async () => {
    try {
      // Add timeout protection (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeline query timeout')), 10000);
      });

      const queryPromise = supabaseValidation
        .from('runner_season_info')
        .select('season, race_distance, coach')
        .eq('email_id', targetEmail.toLowerCase())
        .order('season_no', { ascending: false });

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]).catch((err) => {
        console.error('Timeline query failed or timed out:', err);
        return { data: null, error: err };
      }) as { data: Array<{ season: string; race_distance: string | null; coach: string | null }> | null; error: any };

      if (error) {
        console.error('Error fetching timeline:', error);
        return;
      }

      console.log('Fetched timeline data:', data);

      if (!data || data.length === 0) {
        setTimelineData([]);
        return;
      }

      // Get unique coach names to fetch their profile pictures
      const uniqueCoaches = Array.from(new Set(data.map(entry => entry.coach).filter(Boolean))) as string[];
      console.log('[PROFILE] Fetching pictures for coaches:', uniqueCoaches);

      // Fetch coach profile pictures and profile URLs from rhwb_coaches table
      let coachPictures: Record<string, string | null> = {};
      let coachProfileUrls: Record<string, string | null> = {};
      if (uniqueCoaches.length > 0) {
        const { data: coachData, error: coachError } = await supabaseValidation
          .from('rhwb_coaches')
          .select('coach, profile_picture, profile_url')
          .in('coach', uniqueCoaches);

        if (coachError) {
          console.error('[PROFILE] Error fetching coach data:', coachError);
        } else if (coachData) {
          coachData.forEach((coach: { coach: string; profile_picture: string | null; profile_url: string | null }) => {
            coachPictures[coach.coach] = coach.profile_picture;
            coachProfileUrls[coach.coach] = coach.profile_url;
          });
          console.log('[PROFILE] Loaded coach pictures:', coachPictures);
          console.log('[PROFILE] Loaded coach profile URLs:', coachProfileUrls);
        }
      }

      // Merge coach pictures and profile URLs into timeline data
      const timelineWithCoachPictures: TimelineEntry[] = data.map(entry => ({
        ...entry,
        coach_picture: entry.coach ? (coachPictures[entry.coach] || null) : null,
        coach_profile_url: entry.coach ? (coachProfileUrls[entry.coach] || null) : null
      }));

      setTimelineData(timelineWithCoachPictures);
    } catch (err) {
      console.error('Error loading timeline:', err);
    }
  }, [targetEmail]);

  const capitalizeWords = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };


  useEffect(() => {
    // Use targetEmail which respects override mode
    if (targetEmail) {
      fetchProfileData();
      fetchTimelineData();
    }
  }, [targetEmail, fetchProfileData, fetchTimelineData]);

  // Load referred_by_email_id when profile loads (read-only display)
  useEffect(() => {
    const loadReferredByData = async () => {
      // Load the saved referred_by_email_id
      if (profileData?.referred_by_email_id) {
        try {
          // Fetch the runner name for display
          const { data, error } = await supabaseValidation
            .from('runners_profile')
            .select('runner_name, city')
            .eq('email_id', profileData.referred_by_email_id.toLowerCase())
            .single();

          if (!error && data) {
            const displayName = `${capitalizeWords(data.runner_name)}${data.city ? `, ${capitalizeWords(data.city)}` : ''}`;
            setReferredByValue(displayName);
          } else {
            // If lookup fails, show the email
            setReferredByValue(profileData.referred_by_email_id);
          }
        } catch (err) {
          console.error('[PROFILE] Error fetching referred by name:', err);
          setReferredByValue(profileData.referred_by_email_id);
        }
      } else {
        // No referred_by_email_id, check if there's a legacy referred_by value
        if (profileData?.referred_by) {
          setReferredByValue(capitalizeWords(profileData.referred_by));
        } else {
          setReferredByValue(null);
        }
      }
    };

    loadReferredByData();
  }, [profileData?.referred_by_email_id, profileData?.referred_by]);

  // Handle file selection - validates and opens crop modal
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.email) return;

    // Reset file input so the same file can be selected again
    event.target.value = '';

    // Block avatar upload in override mode (admin viewing another user's profile)
    if (isOverrideActive) {
      alert('Cannot modify profile picture when viewing another user\'s profile');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Read file as data URL and open crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Handle crop complete - uploads cropped image to Supabase
  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user?.email) return;

    try {
      setUploading(true);
      setShowCropModal(false);

      // Generate unique filename with email and timestamp (always .jpg for cropped images)
      const fileName = `${user.email.toLowerCase()}/avatar-${Date.now()}.jpg`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile_pictures')
        .upload(fileName, croppedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Failed to upload image. Please try again.');
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_pictures')
        .getPublicUrl(fileName);

      console.log('Upload successful! File path:', fileName);
      console.log('Public URL:', publicUrl);

      // Update database with new profile picture URL based on user role
      const userRole = user?.role;
      let tableName: string;

      if (userRole === 'admin') {
        tableName = 'rhwb_admin';
      } else if (userRole === 'coach' || userRole === 'hybrid') {
        tableName = 'rhwb_coaches';
      } else {
        tableName = 'runners_profile';
      }

      console.log(`[PROFILE] Updating profile_picture in ${tableName} for:`, user.email.toLowerCase());
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ profile_picture: publicUrl })
        .eq('email_id', user.email.toLowerCase());
      console.log('[PROFILE] Profile picture update result:', { updateError });

      if (updateError) {
        console.error('Database update error:', updateError);
        alert('Failed to update profile. Please try again.');
        return;
      }

      console.log('Database updated with URL:', publicUrl);

      // Refresh profile data to show new avatar
      await fetchProfileData();

      console.log('Profile refreshed. New profile_picture:', profileData?.profile_picture);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setUploading(false);
      setSelectedImageSrc('');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not provided';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };


  const DetailItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Box sx={{
        width: 32,
        height: 32,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(24, 119, 242, 0.1)',
        color: '#1877F2',
        mr: 1.5,
        flexShrink: 0,
        fontSize: '1.1rem'
      }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', mt: 0.25, fontSize: '0.875rem' }}>
          {value || 'Not provided'}
        </Typography>
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      {/* Override Mode Banner */}
      {isOverrideActive && (
        <Alert 
          severity="info" 
          sx={{ 
            borderRadius: 0,
            '& .MuiAlert-message': { width: '100%' }
          }}
        >
          <Typography variant="body2">
            <strong>Override Mode:</strong> Viewing profile for <strong>{overrideEmail}</strong>. 
            Profile modifications are disabled.
          </Typography>
        </Alert>
      )}
      
      {/* Hero Section with Running Theme */}
      <Box sx={{
        position: 'relative',
        background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 50%, #0A4EB0 100%)',
        color: 'white',
        pt: 3,
        pb: 4,
        px: 3,
        overflow: 'hidden'
      }}>
        {/* Back Button */}
        <IconButton
          onClick={() => navigate('/')}
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.3)'
            },
            width: 36,
            height: 36
          }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>

        {/* Decorative Running Icon */}
        <Box sx={{
          position: 'absolute',
          bottom: 15,
          right: 20,
          opacity: 0.12,
          transform: 'rotate(15deg)'
        }}>
          <DirectionsRunIcon sx={{ fontSize: 70 }} />
        </Box>

        {/* Profile Content */}
        <Box sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          maxWidth: '1200px',
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 }
        }}>
          {/* Avatar with Upload */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <Avatar
              src={profileData?.profile_picture || undefined}
              onClick={handleAvatarClick}
              sx={{
                width: 90,
                height: 90,
                bgcolor: 'white',
                color: '#1877F2',
                border: '3px solid white',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                cursor: isOverrideActive ? 'default' : 'pointer',
                '&:hover': {
                  opacity: isOverrideActive ? 1 : 0.8
                }
              }}
            >
              {!profileData?.profile_picture && <DirectionsRunIcon sx={{ fontSize: '3rem' }} />}
            </Avatar>

            {/* Camera Icon Overlay */}
            <IconButton
              onClick={handleAvatarClick}
              disabled={uploading || isOverrideActive}
                sx={{
                  position: 'absolute',
                  bottom: -5,
                  right: -5,
                  width: 32,
                  height: 32,
                  bgcolor: '#1877F2',
                  color: 'white',
                  '&:hover': {
                    bgcolor: '#0E5FD3'
                  },
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                {uploading ? (
                  <CircularProgress size={16} sx={{ color: 'white' }} />
                ) : (
                  <CameraAltIcon sx={{ fontSize: '1rem' }} />
                )}
              </IconButton>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, fontSize: '1.5rem', mb: 0.5 }}>
              {profileData?.runner_name || user?.name || 'Runner'}
            </Typography>

            <Typography variant="body2" sx={{ opacity: 0.95, fontSize: '0.875rem' }}>
              {profileData?.email_id || user?.email}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Personal Details Section */}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Card sx={{
          borderRadius: 3,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
          p: { xs: 2, sm: 2.5, md: 3 },
          bgcolor: 'white'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
            <Box sx={{
              width: 5,
              height: 28,
              bgcolor: '#1877F2',
              borderRadius: 999,
              mr: 1.5
            }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#333', fontSize: '1.25rem' }}>
              Personal Details
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {/* Gender */}
            <Grid item xs={12} sm={6}>
              <DetailItem
                icon={profileData?.gender?.toLowerCase() === 'male' ? <MaleIcon /> : <FemaleIcon />}
                label="Gender"
                value={profileData?.gender || 'Not specified'}
              />
            </Grid>

            {/* Date of Birth */}
            <Grid item xs={12} sm={6}>
              <DetailItem
                icon={<CakeIcon />}
                label="Date of Birth"
                value={formatDate(profileData?.dob || '')}
              />
            </Grid>

            {/* Phone Number */}
            <Grid item xs={12} sm={6}>
              <DetailItem
                icon={<PhoneIcon />}
                label="Phone Number"
                value={profileData?.phone_no || 'Not provided'}
              />
            </Grid>

            {/* Referred By */}
            <Grid item xs={12} sm={6}>
              <DetailItem
                icon={<PersonAddIcon />}
                label="Referred By"
                value={referredByValue || 'Not provided'}
              />
            </Grid>

            {/* Complete Address */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Box sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(24, 119, 242, 0.1)',
                  color: '#1877F2',
                  mr: 1.5,
                  flexShrink: 0,
                  fontSize: '1.1rem'
                }}>
                  <LocationOnIcon />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', lineHeight: 1.2 }}>
                    Address
                  </Typography>
                  <Box sx={{ mt: 0.25 }}>
                    {profileData?.address ? (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', fontSize: '0.875rem', lineHeight: 1.5 }}>
                          {profileData.address}
                        </Typography>
                        {(profileData?.city || profileData?.state || profileData?.zip) && (
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', fontSize: '0.875rem', lineHeight: 1.5 }}>
                            {[profileData.city, profileData.state, profileData.zip].filter(Boolean).join(', ')}
                          </Typography>
                        )}
                        {profileData?.country && (
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', fontSize: '0.875rem', lineHeight: 1.5 }}>
                            {profileData.country}
                          </Typography>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', fontSize: '0.875rem', mt: 0.25 }}>
                        Not provided
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Card>

        {/* RHWB Timeline Section */}
        <Card sx={{
          borderRadius: 3,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
          p: { xs: 2, sm: 2.5, md: 3 },
          bgcolor: 'white',
          mt: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
            <Box sx={{
              width: 5,
              height: 28,
              bgcolor: '#1877F2',
              borderRadius: 999,
              mr: 1.5
            }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#333', fontSize: '1.25rem' }}>
              RHWB Timeline
            </Typography>
          </Box>

          {timelineData.length === 0 ? (
            <Box sx={{
              textAlign: 'center',
              py: 4,
              color: '#999'
            }}>
              <TimelineIcon sx={{ fontSize: '3rem', mb: 1, opacity: 0.3 }} />
              <Typography variant="body2">
                No season history available
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {timelineData.map((entry, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: '#f0f2f5',
                      borderColor: '#1877F2',
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  {/* Season Badge */}
                  <Box sx={{
                    minWidth: 100,
                    height: 50,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    boxShadow: '0 2px 8px rgba(24, 119, 242, 0.3)',
                    mr: 2,
                    flexShrink: 0
                  }}>
                    {entry.season}
                  </Box>

                  {/* Timeline Details */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Grid container spacing={2}>
                      {/* Race Distance */}
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmojiEventsIcon sx={{ fontSize: '1.2rem', color: '#1877F2' }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>
                              Race Distance
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', fontSize: '0.875rem' }}>
                              {entry.race_distance || 'Not specified'}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      {/* Coach */}
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {entry.coach ? (
                            entry.coach_profile_url ? (
                              <a
                                href={entry.coach_profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: 'none' }}
                              >
                                <Avatar
                                  src={entry.coach_picture || undefined}
                                  sx={{
                                    width: 84,
                                    height: 84,
                                    fontSize: '1.5rem',
                                    fontWeight: 600,
                                    bgcolor: entry.coach_picture ? 'transparent' : '#1877F2',
                                    color: 'white',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      opacity: 0.8,
                                      boxShadow: '0 2px 8px rgba(24, 119, 242, 0.4)'
                                    }
                                  }}
                                >
                                  {!entry.coach_picture && getInitials(entry.coach)}
                                </Avatar>
                              </a>
                            ) : (
                              <Avatar
                                src={entry.coach_picture || undefined}
                                sx={{
                                  width: 84,
                                  height: 84,
                                  fontSize: '1.5rem',
                                  fontWeight: 600,
                                  bgcolor: entry.coach_picture ? 'transparent' : '#1877F2',
                                  color: 'white'
                                }}
                              >
                                {!entry.coach_picture && getInitials(entry.coach)}
                              </Avatar>
                            )
                          ) : (
                            <SportsIcon sx={{ fontSize: '1.2rem', color: '#1877F2' }} />
                          )}
                          <Box>
                            <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>
                              Coach
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', fontSize: '0.875rem' }}>
                              {entry.coach || 'Not assigned'}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Card>

        {/* Back Button at Bottom */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
          <Button
            onClick={() => navigate('/')}
            variant="contained"
            size="medium"
            startIcon={<ArrowBackIcon />}
            sx={{
              borderRadius: 999,
              px: 4,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
              boxShadow: '0 4px 12px rgba(24, 119, 242, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0E5FD3 0%, #0A4EB0 100%)',
                boxShadow: '0 6px 16px rgba(24, 119, 242, 0.4)'
              }
            }}
          >
            Back to Dashboard
          </Button>
        </Box>
      </Container>

      {/* Photo Source Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            mt: 1,
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }
        }}
      >
        <MenuItem onClick={handleCameraOption} sx={{ py: 1.5 }}>
          <ListItemIcon>
            <CameraAltIcon sx={{ color: '#1877F2' }} />
          </ListItemIcon>
          <ListItemText primary="Take Photo" />
        </MenuItem>
        <MenuItem onClick={handleUploadOption} sx={{ py: 1.5 }}>
          <ListItemIcon>
            <PhotoLibraryIcon sx={{ color: '#1877F2' }} />
          </ListItemIcon>
          <ListItemText primary="Upload Photo" />
        </MenuItem>
      </Menu>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        open={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraCapture}
      />

      {/* Image Crop Modal */}
      <ImageCropModal
        open={showCropModal}
        imageSrc={selectedImageSrc}
        onClose={() => {
          setShowCropModal(false);
          setSelectedImageSrc('');
        }}
        onCropComplete={handleCropComplete}
      />
    </Box>
  );
};

export default UserProfile;
