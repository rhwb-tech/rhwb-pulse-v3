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
  Autocomplete,
  TextField
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
import TimelineIcon from '@mui/icons-material/Timeline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsIcon from '@mui/icons-material/Sports';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseValidation } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

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
  referred_by: string;
  profile_picture: string | null;
}

interface TimelineEntry {
  season: string;
  race_distance: string | null;
  coach: string | null;
}

interface RunnerOption {
  runner_name: string;
  city: string;
}

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<RunnerProfile | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [runnersList, setRunnersList] = useState<RunnerOption[]>([]);
  const [referredByValue, setReferredByValue] = useState<string | null>(null);
  const [savingReferredBy, setSavingReferredBy] = useState(false);
  const referredByInputRef = useRef<string>('');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[PROFILE] Starting profile fetch for:', user?.email);

      // Add timeout protection (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile query timeout')), 10000);
      });

      console.log('[PROFILE] Creating query...');
      const startTime = Date.now();
      const queryPromise = supabaseValidation
        .from('runners_profile')
        .select('email_id, runner_name, gender, address, zip, city, state, country, phone_no, dob, referred_by, profile_picture')
        .eq('email_id', user?.email?.toLowerCase())
        .single();

      console.log('[PROFILE] Query created, waiting for response...');
      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]).catch((err) => {
        const elapsed = Date.now() - startTime;
        console.error(`[PROFILE] Profile query failed or timed out after ${elapsed}ms:`, err);
        return { data: null, error: err };
      }) as { data: RunnerProfile | null; error: any };

      const elapsed = Date.now() - startTime;
      console.log(`[PROFILE] Query completed in ${elapsed}ms`);

      if (error) {
        console.error('[PROFILE] Supabase client error, trying direct fetch fallback...');

        // Fallback: Try direct REST API call
        try {
          const directStartTime = Date.now();
          const url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/runners_profile?email_id=eq.${encodeURIComponent(user?.email?.toLowerCase() || '')}`;
          const response = await fetch(url, {
            headers: {
              'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`,
            },
          });

          const directElapsed = Date.now() - directStartTime;
          console.log(`[PROFILE] Direct fetch completed in ${directElapsed}ms`);

          if (response.ok) {
            const jsonData = await response.json();
            if (jsonData && jsonData.length > 0) {
              console.log('[PROFILE] Direct fetch succeeded, using data');
              setProfileData(jsonData[0]);
              return;
            }
          }
        } catch (directError) {
          console.error('[PROFILE] Direct fetch also failed:', directError);
        }

        console.error('Error fetching profile:', error);
        return;
      }

      console.log('Fetched profile data:', data);
      console.log('Profile picture URL from DB:', data?.profile_picture);
      setProfileData(data);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  const fetchTimelineData = useCallback(async () => {
    try {
      // Add timeout protection (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeline query timeout')), 10000);
      });

      const queryPromise = supabaseValidation
        .from('runner_season_info')
        .select('season, race_distance, coach')
        .eq('email_id', user?.email?.toLowerCase())
        .order('season_no', { ascending: false });

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]).catch((err) => {
        console.error('Timeline query failed or timed out:', err);
        return { data: null, error: err };
      }) as { data: TimelineEntry[] | null; error: any };

      if (error) {
        console.error('Error fetching timeline:', error);
        return;
      }

      console.log('Fetched timeline data:', data);
      setTimelineData(data || []);
    } catch (err) {
      console.error('Error loading timeline:', err);
    }
  }, [user?.email]);

  const capitalizeWords = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const fetchRunnersList = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('runners_profile')
        .select('runner_name, city')
        .order('runner_name', { ascending: true });

      if (error) {
        console.error('Error fetching runners list:', error);
        return;
      }

      // Filter to get only distinct runner names
      const seenNames = new Set<string>();
      const distinctRunners = (data || []).filter((runner) => {
        if (!runner.runner_name || seenNames.has(runner.runner_name)) {
          return false;
        }
        seenNames.add(runner.runner_name);
        return true;
      });

      setRunnersList(distinctRunners);
    } catch (err) {
      console.error('Error loading runners list:', err);
    }
  }, []);

  useEffect(() => {
    if (user?.email) {
      fetchProfileData();
      fetchTimelineData();
      fetchRunnersList();
    }
  }, [user?.email, fetchProfileData, fetchTimelineData, fetchRunnersList]);

  useEffect(() => {
    if (profileData?.referred_by) {
      // Capitalize the existing value when loading
      setReferredByValue(capitalizeWords(profileData.referred_by));
    } else {
      setReferredByValue(null);
    }
  }, [profileData?.referred_by]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.email) return;

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

    try {
      setUploading(true);

      // Generate unique filename with email and timestamp
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.email.toLowerCase()}/avatar-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile_pictures')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
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

      // Update database with new profile picture URL
      const { error: updateError } = await supabase
        .from('runners_profile')
        .update({ profile_picture: publicUrl })
        .eq('email_id', user.email.toLowerCase());

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
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not provided';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleReferredByChange = async (newValue: string | null) => {
    if (!user?.email) return;

    // Capitalize the value before saving
    const capitalizedValue = newValue ? capitalizeWords(newValue) : null;
    setReferredByValue(capitalizedValue);
    setSavingReferredBy(true);

    try {
      const { error } = await supabase
        .from('runners_profile')
        .update({ referred_by: capitalizedValue || null })
        .eq('email_id', user.email.toLowerCase());

      if (error) {
        console.error('Error updating referred_by:', error);
        alert('Failed to update referred by field. Please try again.');
        // Revert to previous value on error
        setReferredByValue(profileData?.referred_by || null);
      } else {
        // Update local state
        if (profileData) {
          setProfileData({ ...profileData, referred_by: capitalizedValue || '' });
        }
      }
    } catch (err) {
      console.error('Error updating referred_by:', err);
      alert('An unexpected error occurred. Please try again.');
      // Revert to previous value on error
      setReferredByValue(profileData?.referred_by || null);
    } finally {
      setSavingReferredBy(false);
    }
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
              id="avatar-upload"
              type="file"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
            <label htmlFor="avatar-upload">
              <Avatar
                src={profileData?.profile_picture || undefined}
                sx={{
                  width: 90,
                  height: 90,
                  bgcolor: 'white',
                  color: '#1877F2',
                  border: '3px solid white',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer',
                  '&:hover': {
                    opacity: 0.8
                  }
                }}
              >
                {!profileData?.profile_picture && <DirectionsRunIcon sx={{ fontSize: '3rem' }} />}
              </Avatar>
            </label>

            {/* Camera Icon Overlay */}
            <label htmlFor="avatar-upload">
              <IconButton
                component="span"
                disabled={uploading}
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
            </label>
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
                  fontSize: '1.1rem',
                  mt: 1
                }}>
                  <PersonAddIcon />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', lineHeight: 1.2, mb: 0.5 }}>
                    Referred By
                  </Typography>
                  <Autocomplete
                    freeSolo
                    open={autocompleteOpen}
                    onOpen={() => {
                      // Only open if user has typed something
                      if (referredByInputRef.current.length > 0) {
                        setAutocompleteOpen(true);
                      }
                    }}
                    onClose={() => setAutocompleteOpen(false)}
                    options={runnersList.map((runner) => ({
                      label: `${capitalizeWords(runner.runner_name)}${runner.city ? `, ${capitalizeWords(runner.city)}` : ''}`,
                      name: runner.runner_name
                    }))}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') {
                        return option;
                      }
                      return option.label;
                    }}
                    isOptionEqualToValue={(option, value) => {
                      if (typeof value === 'string') {
                        return option.name === value;
                      }
                      if (typeof value === 'object' && value !== null) {
                        return option.name === value.name;
                      }
                      return false;
                    }}
                    value={referredByValue || null}
                    onChange={(event, newValue) => {
                      // Extract just the name if it's an object, otherwise use the string value
                      let nameValue: string | null = null;
                      if (typeof newValue === 'object' && newValue !== null) {
                        nameValue = newValue.name;
                      } else if (typeof newValue === 'string') {
                        nameValue = newValue;
                      }
                      handleReferredByChange(nameValue);
                      setAutocompleteOpen(false);
                    }}
                    onInputChange={(event, newInputValue, reason) => {
                      // Track input value as user types
                      referredByInputRef.current = newInputValue;
                      if (reason === 'input') {
                        setReferredByValue(newInputValue);
                        // Open dropdown when user starts typing
                        if (newInputValue.length > 0) {
                          setAutocompleteOpen(true);
                        } else {
                          setAutocompleteOpen(false);
                        }
                      }
                    }}
                    filterOptions={(options, params) => {
                      const searchTerm = params.inputValue.toLowerCase();
                      if (!searchTerm) {
                        return [];
                      }
                      const filtered = options.filter((option) => {
                        const label = option.label.toLowerCase();
                        const name = option.name.toLowerCase();
                        return label.includes(searchTerm) || name.includes(searchTerm);
                      });
                      return filtered;
                    }}
                    renderOption={(props, option) => (
                      <li {...props} key={option.name}>
                        {option.label}
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search and select a name"
                        variant="outlined"
                        size="small"
                        onBlur={() => {
                          // Save when user blurs the field after typing
                          const currentValue = referredByInputRef.current || '';
                          const normalizedCurrent = currentValue.trim();
                          const normalizedStored = (profileData?.referred_by || '').trim();
                          if (normalizedCurrent !== normalizedStored) {
                            handleReferredByChange(normalizedCurrent || null);
                          }
                          setAutocompleteOpen(false);
                        }}
                        onFocus={() => {
                          // Don't open on focus, only when typing
                          setAutocompleteOpen(false);
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.875rem',
                            '& fieldset': {
                              borderColor: '#e0e0e0',
                            },
                            '&:hover fieldset': {
                              borderColor: '#1877F2',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#1877F2',
                            },
                          },
                        }}
                      />
                    )}
                    loading={loading}
                    disabled={savingReferredBy}
                    sx={{
                      '& .MuiAutocomplete-inputRoot': {
                        padding: '4px 9px !important',
                      },
                    }}
                  />
                  {savingReferredBy && (
                    <Typography variant="caption" sx={{ color: '#1877F2', fontSize: '0.7rem', mt: 0.5, display: 'block' }}>
                      Saving...
                    </Typography>
                  )}
                </Box>
              </Box>
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
                          <SportsIcon sx={{ fontSize: '1.2rem', color: '#1877F2' }} />
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
    </Box>
  );
};

export default UserProfile;
