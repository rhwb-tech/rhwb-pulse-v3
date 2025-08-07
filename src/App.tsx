import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Typography, Box, Grid, Chip, Stack, Skeleton, MenuItem, Menu, ListItemText, useMediaQuery } from '@mui/material';
import QuantitativeScores, { QuantitativeScoreData } from './components/QuantitativeScores';
import QuantitativeScoresMobile, { QuantitativeScoreMobileData } from './components/QuantitativeScoresMobile';
import FilterPanel, { UserRole } from './components/FilterPanel';
import { supabase } from './components/supabaseClient';
import CumulativeScore from './components/CumulativeScore';
import ActivitySummary from './components/ActivitySummary';
import TrainingFeedback from './components/TrainingFeedback';
import { useAuth } from './contexts/AuthContext';

interface Option {
  value: string;
  label: string;
}

const DEFAULT_SEASON = '13';

function getQuantSql(season: string, email: string) {
  return `SELECT meso, max(case when category='Personal' then quant end)  as quant_personal,\n       max(case when category='Race Distance' then quant end) as quant_race_distance,\n       max(case when category='Coach' then quant end) as quant_coach\n       FROM rhwb_meso_scores where season = '${season ? `Season ${season}` : ''}' and email_id = '${email}'\nGROUP BY meso`;
}

function getHybridRunnerSql(season: string, email: string) {
  return `SELECT email_id FROM runner_season_info WHERE season = '${season}' AND coach = '${email}'`;
}

function getRunnerListSql(season: string, coach: string) {
  return `SELECT a.email_id, c.runner_name, b.coach FROM runner_season_info a\n    inner join runners_profile c on a.email_id = c.email_id\n    inner join rhwb_coaches b on a.coach = b.coach\n    WHERE season_no = '${season}' AND a.coach = '${coach}'`;
}

function getCoachListSql(season: string) {
  return `SELECT DISTINCT coach FROM runner_season_info WHERE season = '${season}' AND coach IS NOT NULL`;
}

function App() {
  const { user } = useAuth();
  
  // Filter state
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const email = user?.email || '';
  const userRole = user?.role || 'athlete';
  const [coachList, setCoachList] = useState<Option[]>([]);
  const [runnerList, setRunnerList] = useState<Option[]>([]);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedRunner, setSelectedRunner] = useState('');
  const [hybridToggle, setHybridToggle] = useState<'myScore' | 'myCohorts'>('myScore');
  const [coachName, setCoachName] = useState('');

  // Widget data
  const [data, setData] = useState<QuantitativeScoreData[]>([]);
  const [qualitativeData, setQualitativeData] = useState<QuantitativeScoreMobileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if initial load has occurred
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Season dropdown state
  const [seasonMenuAnchor, setSeasonMenuAnchor] = useState<null | HTMLElement>(null);
  const seasonMenuOpen = Boolean(seasonMenuAnchor);
  const [seasonOptions, setSeasonOptions] = useState<Option[]>([]);
  
  // Runner dropdown state
  const [runnerMenuAnchor, setRunnerMenuAnchor] = useState<null | HTMLElement>(null);
  const runnerMenuOpen = Boolean(runnerMenuAnchor);
  
  // Hybrid toggle dropdown state
  const [hybridToggleMenuAnchor, setHybridToggleMenuAnchor] = useState<null | HTMLElement>(null);
  const hybridToggleMenuOpen = Boolean(hybridToggleMenuAnchor);

  // Debug mode state from URL parameter
  const [showDebug, setShowDebug] = useState(false);

  // Responsive breakpoint for mobile detection
  const isMobile = useMediaQuery('(max-width:768px)');

  // Authentication is now handled by JWT context

  // Fetch available seasons
  useEffect(() => {
    const fetchSeasons = async () => {
      const { data: seasons, error } = await supabase
        .from('rhwb_meso_scores')
        .select('season')
        .not('season', 'is', null);
      
      if (error) {
        console.error('Error fetching seasons:', error);
        return;
      }
      
      // Extract unique seasons and sort them in descending order
      const uniqueSeasons = Array.from(new Set(seasons?.map(s => s.season) || []))
        .filter(season => season && season.includes('Season'))
        .map(season => {
          const seasonNumber = season.replace('Season ', '');
          return { value: seasonNumber, label: season };
        })
        .sort((a, b) => parseInt(b.value) - parseInt(a.value)); // Sort descending
      
      setSeasonOptions(uniqueSeasons);
    };
    
    fetchSeasons();
  }, []);

  // Fetch coach name for coach/hybrid roles
  useEffect(() => {
    if ((userRole === 'coach' || userRole === 'hybrid') && email) {
      supabase
        .from('rhwb_coaches')
        .select('coach')
        .eq('email_id', email)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching coach name:', error);
          }
          if (data && data.length > 0) {
            setCoachName(data[0].coach);
          } else {
            console.warn('No coach found for email:', email);
          }
        });
    }
  }, [userRole, email]);

  // Fetch coach/runner lists based on role, season, and selection
  useEffect(() => {
    if (!season) return;
    const fetchLists = async () => {
      if (userRole === 'admin') {
        // Admin: fetch all active coaches
        const { data: coaches, error: coachErr } = await supabase
          .from('rhwb_coaches')
          .select('coach')
          .eq('status', 'Active');
        const uniqueCoaches = Array.from(new Set((coaches || []).map((r: any) => r.coach))).filter(Boolean);
        setCoachList(uniqueCoaches.map((c: string) => ({ value: c, label: c })));
        // Fetch runners for selected coach using the new join query (a.coach)
        if (selectedCoach) {
          const seasonNo = Number(season);
          const { data: runners } = await supabase
            .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: selectedCoach });
          setRunnerList((runners || []).map((r: any) => ({ value: r.email_id, label: r.runner_name })));
        } else {
          setRunnerList([]);
        }
      } else if (userRole === 'coach' || (userRole === 'hybrid' && hybridToggle === 'myCohorts')) {
        // Coach/Hybrid: fetch runners using the new join query (a.coach)
        const coach = coachName;
        if (!coach) {
          console.warn('Coach name not found, cannot fetch runners');
          setRunnerList([]);
          return;
        }
        const seasonNo = Number(season);
        const { data: runners, error: runnersError } = await supabase
          .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: coach });
        
        if (runnersError) {
          console.error('Error fetching runners for coach:', runnersError);
          setRunnerList([]);
          return;
        }
        
        setRunnerList((runners || []).map((r: any) => ({ value: r.email_id, label: r.runner_name })));
      } else {
        // Athlete: no runner/coach lists
        setCoachList([]);
        setRunnerList([]);
      }
    };
    fetchLists();
  }, [season, userRole, selectedCoach, email, hybridToggle, coachName]);

  // Fetch widget data (QuantitativeScores) on Apply
  const fetchWidgetData = useCallback(async () => {
    await fetchWidgetDataForRunner(selectedRunner);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, email, userRole, selectedRunner, hybridToggle]);

  // Fetch widget data for a specific runner
  const fetchWidgetDataForRunner = useCallback(async (runnerEmail: string) => {
    setLoading(true);
    setError(null);
    
    // Fetch quantitative data (use same view for both charts)
    let query = supabase.from('v_quantitative_scores').select('meso, quant_coach, quant_personal, quant_race_distance');
    
    if (userRole === 'admin') {
      if (runnerEmail) {
        query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
      } else {
        setData([]); 
        setQualitativeData([]);
        setLoading(false); 
        return;
      }
    } else if (userRole === 'coach') {
      if (runnerEmail) {
        query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
      } else {
        setData([]); 
        setQualitativeData([]);
        setLoading(false); 
        return;
      }
    } else if (userRole === 'hybrid') {
      if (hybridToggle === 'myCohorts') {
        if (runnerEmail) {
          query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
        } else {
          setData([]); 
          setQualitativeData([]);
          setLoading(false); 
          return;
        }
      } else {
        query = query.eq('season', `Season ${season}`).eq('email_id', email);
      }
    } else {
      // athlete
      query = query.eq('season', `Season ${season}`).eq('email_id', email);
    }
    
    const { data: rows, error } = await query;
    
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    // Format data for quantitative chart (vertical bars)
    const formattedQuant: QuantitativeScoreData[] = (rows || []).map((row: any) => ({
      meso: row.meso,
      personal: row.quant_personal,
      coach: row.quant_coach,
      raceDistance: row.quant_race_distance,
    }));
    
    // Format same data for qualitative chart (horizontal bars) - using same data but different display
    const formattedQual: QuantitativeScoreMobileData[] = (rows || []).map((row: any) => ({
      meso: row.meso,
      personal: row.quant_personal, // Using same data for now
      coach: row.quant_coach,       // Using same data for now
      raceDistance: row.quant_race_distance, // Using same data for now
    }));
    
    setData(formattedQuant);
    setQualitativeData(formattedQual);
    setLoading(false);
  }, [season, email, userRole, hybridToggle]);

  // On initial app load or when email changes from URL, fetch Quantitative Scores
  useEffect(() => {
    if (email && userRole && initialLoad) {
      fetchWidgetData();
      setInitialLoad(false);
    }
    // eslint-disable-next-line
  }, [email, userRole]);

  // When hybrid user selects 'My Score', clear runner selection and filter widget data for logged-in user
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myScore') {
      setSelectedRunner('');
      setTimeout(() => handleApply(), 0);
    }
    // eslint-disable-next-line
  }, [hybridToggle]);

  // When hybrid user selects 'My Cohorts', select the first runner and filter widget data
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myCohorts' && runnerList.length > 0) {
      setSelectedRunner(runnerList[0].value);
      setTimeout(() => handleApply(), 0);
    }
    // eslint-disable-next-line
  }, [hybridToggle, runnerList]);

  // When coach user loads, auto-select the first runner
  useEffect(() => {
    if (userRole === 'coach' && runnerList.length > 0 && !selectedRunner) {
      setSelectedRunner(runnerList[0].value);
      setTimeout(() => handleApply(), 0);
    }
    // eslint-disable-next-line
  }, [userRole, runnerList, selectedRunner]);

  // When admin selects a coach, auto-select the first runner for that coach
  useEffect(() => {
    if (userRole === 'admin' && selectedCoach && runnerList.length > 0) {
      setSelectedRunner(runnerList[0].value);
    }
    // eslint-disable-next-line
  }, [userRole, selectedCoach, runnerList]);

  // Handle Apply
  const handleApply = () => {
    fetchWidgetData();
  };

  // Handle Clear All
  const handleClear = () => {
    setSeason(DEFAULT_SEASON);
    setSelectedCoach('');
    setSelectedRunner('');
    setHybridToggle('myScore');
    setData([]);
    // Email and role come from JWT, no need to reset
  };

  // Handle coach change for admin: set coach, select first runner, and auto-apply
  const handleCoachChange = (coach: string) => {
    setSelectedCoach(coach);
    setTimeout(() => {
      if (runnerList.length > 0) {
        setSelectedRunner(runnerList[0].value);
        setTimeout(() => handleApply(), 0);
      } else {
        setSelectedRunner('');
        handleApply();
      }
    }, 0); // Ensure state is updated before applying
  };

  // Handle runner change: set runner and auto-apply
  const handleRunnerChange = (runner: string) => {
    setSelectedRunner(runner);
    setTimeout(() => handleApply(), 0); // Ensure state is updated before applying
  };

  // Season dropdown handlers
  const handleSeasonMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSeasonMenuAnchor(event.currentTarget);
  };

  const handleSeasonMenuClose = () => {
    setSeasonMenuAnchor(null);
  };

  const handleSeasonChange = (newSeason: string) => {
    setSeason(newSeason);
    setSeasonMenuAnchor(null);
    setTimeout(() => handleApply(), 0); // Ensure state is updated before applying
  };

  // Runner dropdown handlers
  const handleRunnerMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setRunnerMenuAnchor(event.currentTarget);
  };

  const handleRunnerMenuClose = () => {
    setRunnerMenuAnchor(null);
  };

  const handleRunnerChangeFromChip = (newRunner: string) => {
    setSelectedRunner(newRunner);
    setRunnerMenuAnchor(null);
    // Use the newRunner value directly instead of relying on state update
    setTimeout(() => {
      // Pass the new runner value directly to avoid stale state
      fetchWidgetDataForRunner(newRunner);
    }, 0); // Ensure state is updated before applying
  };

  // Hybrid toggle dropdown handlers
  const handleHybridToggleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setHybridToggleMenuAnchor(event.currentTarget);
  };

  const handleHybridToggleMenuClose = () => {
    setHybridToggleMenuAnchor(null);
  };

  const handleHybridToggleChangeFromChip = async (newToggle: 'myScore' | 'myCohorts') => {
    setHybridToggle(newToggle);
    setHybridToggleMenuAnchor(null);
    
    // If switching to 'myCohorts' and we have runners, select the first one
    if (newToggle === 'myCohorts' && runnerList.length > 0) {
      setSelectedRunner(runnerList[0].value);
      setTimeout(() => handleApply(), 0); // Ensure state is updated before applying
    } else if (newToggle === 'myScore') {
      // Clear selected runner when switching to 'myScore'
      setSelectedRunner('');
      setTimeout(() => handleApply(), 0);
    } else {
      setTimeout(() => handleApply(), 0);
    }
    
    // Log the toggle interaction
    if (user?.email) {
      try {
        const { error } = await supabase
          .from('pulse_interactions')
          .insert({
            email_id: user.email,
            event_name: 'hybrid toggle',
            value_text: newToggle,
            value_label: `From ${hybridToggle} to ${newToggle}`
          });
        
        if (error) {
          console.error('Error logging hybrid toggle interaction:', error);
        }
      } catch (err) {
        console.error('Error logging hybrid toggle interaction:', err);
      }
    }
  };

  // Determine which props to show in FilterPanel
  const filterPanelProps: any = {
    season,
    onSeasonChange: setSeason,
    seasonOptions,
    email,
    onApply: handleApply,
    onClear: handleClear,
    userRole: userRole,
  };
  if (userRole === 'admin') {
    filterPanelProps.coachList = coachList;
    filterPanelProps.onCoachChange = handleCoachChange;
    filterPanelProps.selectedCoach = selectedCoach;
    filterPanelProps.runnerList = runnerList;
    filterPanelProps.onRunnerChange = handleRunnerChange;
    filterPanelProps.selectedRunner = selectedRunner;
    filterPanelProps.onEmailChange = () => {};
  } else if (userRole === 'coach') {
    filterPanelProps.runnerList = runnerList;
    filterPanelProps.onRunnerChange = handleRunnerChange;
    filterPanelProps.selectedRunner = selectedRunner;
    filterPanelProps.onEmailChange = () => {};
  } else if (userRole === 'hybrid') {
    // Hybrid users don't have filters in FilterPanel - they use tabs above
    filterPanelProps.onEmailChange = () => {};
  } else {
    // athlete
    filterPanelProps.onEmailChange = () => {};
  }

  const [cumulativeScore, setCumulativeScore] = useState<number | null>(null);

  // Fetch latest cumulative score for the selected runner (or logged-in user)
  const fetchCumulativeScore = useCallback(async () => {
    const runnerEmail = selectedRunner || email;
    if (!runnerEmail) {
      setCumulativeScore(null);
      return;
    }
    // Fetch all personal scores for this runner and season
    const { data: rows, error } = await supabase
      .from('rhwb_meso_scores')
      .select('email_id, season, meso, cumulative_score')
      .eq('email_id', runnerEmail)
      .eq('season', `Season ${season}`)
      .eq('category', 'Personal');
    if (error || !rows || rows.length === 0) {
      setCumulativeScore(null);
      return;
    }
    // Find the row with the highest meso number (assuming meso is like 'Meso 1', 'Meso 2', ...)
    const latest = rows.reduce((max, row) => {
      const mesoNum = parseInt((row.meso || '').replace(/[^0-9]/g, ''), 10);
      const maxNum = parseInt((max.meso || '').replace(/[^0-9]/g, ''), 10);
      return mesoNum > maxNum ? row : max;
    }, rows[0]);
    setCumulativeScore(latest.cumulative_score);
  }, [selectedRunner, email, season]);

  // Fetch cumulative score when runner, email, or season changes
  useEffect(() => {
    fetchCumulativeScore();
  }, [fetchCumulativeScore]);

  const [activitySummary, setActivitySummary] = useState<{
    mileage: { percent: number | null; planned: number | null; completed: number | null };
    strength: { percent: number | null; planned: number | null; completed: number | null };
  }>({
    mileage: { percent: null, planned: null, completed: null },
    strength: { percent: null, planned: null, completed: null }
  });
  const [trainingFeedback, setTrainingFeedback] = useState<Array<{meso: string, qual: string}>>([]);

  // Fetch Activity Summary data for the selected runner (or logged-in user)
  const fetchActivitySummary = useCallback(async () => {
    const runnerEmail = selectedRunner || email;
    if (!runnerEmail) {
      setActivitySummary({
        mileage: { percent: null, planned: null, completed: null },
        strength: { percent: null, planned: null, completed: null }
      });
      return;
    }
    // Fetch activity summary for this runner and season
    const { data: rows, error } = await supabase
      .from('v_activity_summary')
      .select('category, percent_completed, planned, completed')
      .eq('season', `Season ${season}`)
      .eq('email_id', runnerEmail);
    if (error || !rows) {
      setActivitySummary({
        mileage: { percent: null, planned: null, completed: null },
        strength: { percent: null, planned: null, completed: null }
      });
      return;
    }
    let mileage = { percent: null, planned: null, completed: null };
    let strength = { percent: null, planned: null, completed: null };
    for (const row of rows) {
      if (row.category === 'Mileage') {
        mileage = {
          percent: row.percent_completed,
          planned: row.planned,
          completed: row.completed
        };
      }
      if (row.category === 'Strength') {
        strength = {
          percent: row.percent_completed,
          planned: row.planned,
          completed: row.completed
        };
      }
    }
    setActivitySummary({ mileage, strength });
  }, [selectedRunner, email, season]);

  // Fetch Training Feedback data for the selected runner (or logged-in user)
  const fetchTrainingFeedback = useCallback(async () => {
    const runnerEmail = selectedRunner || email;
    if (!runnerEmail) {
      setTrainingFeedback([]);
      return;
    }
    // Fetch training feedback for this runner and season
    const { data: rows, error } = await supabase
      .from('rhwb_meso_scores')
      .select('meso, qual')
      .eq('season', `Season ${season}`)
      .eq('email_id', runnerEmail)
      .eq('category', 'Personal')
      .not('qual', 'is', null);
    if (error || !rows) {
      setTrainingFeedback([]);
      return;
    }
    // Sort by meso in descending order (extract number from meso string)
    const sortedRows = rows.sort((a, b) => {
      const mesoA = parseInt(a.meso.replace(/[^0-9]/g, ''), 10);
      const mesoB = parseInt(b.meso.replace(/[^0-9]/g, ''), 10);
      return mesoB - mesoA; // Descending order
    });
    setTrainingFeedback(sortedRows);
  }, [selectedRunner, email, season]);

  useEffect(() => {
    fetchActivitySummary();
  }, [fetchActivitySummary]);

  useEffect(() => {
    fetchTrainingFeedback();
  }, [fetchTrainingFeedback]);

  // Check for debug parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug');
    setShowDebug(debugParam === 'true');
  }, []);

  // Check for email parameter in URL and set as selectedRunner
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam) {
      setSelectedRunner(emailParam);
    }
  }, []);

  // Log app access to pulse_interactions table
  useEffect(() => {
    const logAppAccess = async () => {
      if (user?.email) {
        try {
          const { error } = await supabase
            .from('pulse_interactions')
            .insert({
              email_id: user.email,
              event_name: 'access',
              value_text: null
            });
          
          if (error) {
            console.error('Error logging app access:', error);
          } else {
            console.log('App access logged successfully');
          }
        } catch (err) {
          console.error('Error logging app access:', err);
        }
      }
    };

    logAppAccess();
  }, [user?.email]); // Only run when user email changes (i.e., when user logs in)

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrative View';
      case 'coach': return 'Coach View';
      case 'hybrid': return 'Athlete Performance';
      default: return 'Athlete View';
    }
  };



  return (
    <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 1 }}>
      {/* Selection Chips Panel */}
      <Box sx={{ 
        mb: 2, 
        display: 'flex', 
        justifyContent: 'flex-start',
        overflowX: { xs: 'visible', sm: 'auto' },
        pb: 1,
        '&::-webkit-scrollbar': {
          height: 6,
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: '#f1f1f1',
          borderRadius: 3,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: '#c1c1c1',
          borderRadius: 3,
        },
      }}>
        {/* Desktop Layout - Horizontal */}
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          sx={{ 
            minWidth: 'fit-content',
            width: '100%'
          }}
        >
          {/* First Row - Season and Hybrid Toggle */}
          <Stack 
            direction="row" 
            spacing={2} 
            sx={{ 
              minWidth: 'fit-content',
              flexWrap: 'wrap'
            }}
          >
            <Chip
              label={`Season ${season}`}
              onClick={handleSeasonMenuOpen}
              sx={{
                bgcolor: '#e3f2fd',
                color: '#1976d2',
                fontWeight: 600,
                fontSize: { xs: 14, sm: 16, md: 18 },
                borderRadius: 999,
                px: 2,
                py: 1,
                minWidth: 'fit-content',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: '#bbdefb',
                },
              }}
            />
            <Menu
              anchorEl={seasonMenuAnchor}
              open={seasonMenuOpen}
              onClose={handleSeasonMenuClose}
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
                  minWidth: 120,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                }
              }}
            >
              {seasonOptions.map((seasonOption) => (
                <MenuItem
                  key={seasonOption.value}
                  onClick={() => handleSeasonChange(seasonOption.value)}
                  selected={season === seasonOption.value}
                  sx={{
                    minHeight: 40,
                    '&.Mui-selected': {
                      bgcolor: '#e3f2fd',
                      color: '#1976d2',
                      fontWeight: 600,
                    },
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                    },
                  }}
                >
                  <ListItemText primary={seasonOption.label} />
                </MenuItem>
              ))}
            </Menu>
            
            {/* Show hybrid toggle chip for hybrid users */}
            {userRole === 'hybrid' && (
              <Chip
                label={hybridToggle === 'myScore' ? 'My Score' : 'My Cohorts'}
                onClick={handleHybridToggleMenuOpen}
                sx={{
                  bgcolor: '#e3f2fd',
                  color: '#1976d2',
                  fontWeight: 600,
                  fontSize: { xs: 14, sm: 16, md: 18 },
                  borderRadius: 999,
                  px: 2,
                  py: 1,
                  minWidth: 'fit-content',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: '#bbdefb',
                  },
                }}
              />
            )}
            <Menu
              anchorEl={hybridToggleMenuAnchor}
              open={hybridToggleMenuOpen}
              onClose={handleHybridToggleMenuClose}
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
                  minWidth: 150,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                }
              }}
            >
              {[
                { value: 'myScore', label: 'My Score' },
                { value: 'myCohorts', label: 'My Cohorts' }
              ].map((toggleOption) => (
                <MenuItem
                  key={toggleOption.value}
                  onClick={() => handleHybridToggleChangeFromChip(toggleOption.value as 'myScore' | 'myCohorts')}
                  selected={hybridToggle === toggleOption.value}
                  sx={{
                    minHeight: 40,
                    '&.Mui-selected': {
                      bgcolor: '#e3f2fd',
                      color: '#1976d2',
                      fontWeight: 600,
                    },
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                    },
                  }}
                >
                  <ListItemText primary={toggleOption.label} />
                </MenuItem>
              ))}
            </Menu>
            
            {/* Show coach chip for admin if selected */}
            {userRole === 'admin' && selectedCoach && (
              <Chip
                label={selectedCoach}
                sx={{
                  bgcolor: '#e3f2fd',
                  color: '#1976d2',
                  fontWeight: 600,
                  fontSize: { xs: 14, sm: 16, md: 18 },
                  borderRadius: 999,
                  px: 2,
                  py: 1,
                  minWidth: 'fit-content',
                  whiteSpace: 'nowrap',
                }}
              />
            )}
          </Stack>
          
          {/* Second Row - Runner Chip (Mobile) or Same Row (Desktop) */}
          {selectedRunner && (
            <Chip
              label={runnerList.find(r => r.value === selectedRunner)?.label || selectedRunner}
              onClick={handleRunnerMenuOpen}
              sx={{
                bgcolor: '#e3f2fd',
                color: '#1976d2',
                fontWeight: 600,
                fontSize: { xs: 14, sm: 16, md: 18 },
                borderRadius: 999,
                px: 2,
                py: 1,
                minWidth: 'fit-content',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: '#bbdefb',
                },
              }}
            />
          )}
          <Menu
            anchorEl={runnerMenuAnchor}
            open={runnerMenuOpen}
            onClose={handleRunnerMenuClose}
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
                maxHeight: 300,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                borderRadius: 2,
                border: '1px solid #e0e0e0',
              }
            }}
          >
            {runnerList.map((runnerOption) => (
              <MenuItem
                key={runnerOption.value}
                onClick={() => handleRunnerChangeFromChip(runnerOption.value)}
                selected={selectedRunner === runnerOption.value}
                sx={{
                  minHeight: 40,
                  '&.Mui-selected': {
                    bgcolor: '#e3f2fd',
                    color: '#1976d2',
                    fontWeight: 600,
                  },
                  '&:hover': {
                    bgcolor: '#f5f5f5',
                  },
                }}
              >
                <ListItemText primary={runnerOption.label} />
              </MenuItem>
            ))}
          </Menu>
        </Stack>
      </Box>



      {/* Widgets Grid */}
        {/* Widgets Grid */}
        {loading ? (
          <Grid container spacing={{ xs: 1, sm: 2, md: 4 }} sx={{ mt: { xs: 0, sm: 1 } }}>
            {/* Top row skeleton */}
            <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white', 
                p: 2, 
                height: 350,
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="rectangular" width="100%" height={280} sx={{ mt: 2 }} />
              </Box>
            </Grid>
            {/* Bottom row skeletons */}
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white', 
                p: 2, 
                height: 350,
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <Skeleton variant="text" width="50%" height={32} />
                <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto', mt: 3 }} />
                <Skeleton variant="text" width="30%" height={24} sx={{ mx: 'auto', mt: 2 }} />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white', 
                p: 2, 
                height: 350,
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <Skeleton variant="text" width="50%" height={32} />
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 4 }}>
                  <Skeleton variant="circular" width={120} height={120} />
                  <Skeleton variant="circular" width={120} height={120} />
                </Box>
              </Box>
            </Grid>
          </Grid>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>
        ) : (
          <Grid container spacing={{ xs: 1, sm: 2, md: 4 }} sx={{ mt: { xs: 0, sm: 1 } }}>
            {/* Top row - Full width chart */}
            <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1,
                display: isMobile ? 'none' : 'block'
              }}>
                <QuantitativeScores data={data} />
              </Box>
            </Grid>
            {/* Mobile Quantitative Score - Full width vertical chart */}
            <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1,
                display: isMobile ? 'block' : 'none'
              }}>
                <QuantitativeScoresMobile data={qualitativeData} />
              </Box>
            </Grid>
            {/* Bottom row - Side by side on md+ */}
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <CumulativeScore score={cumulativeScore ?? 0} target={5} />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <ActivitySummary
                  activityData={activitySummary}
                />
              </Box>
            </Grid>
            {/* Training Feedback Widget - Full width */}
            <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <TrainingFeedback 
                  feedback={trainingFeedback} 
                  userEmail={user?.email} 
                  emailId={selectedRunner || email}
                />
              </Box>
            </Grid>
          </Grid>
        )}
        
        {/* Debug Section - Only show when debug=true in URL */}
        {showDebug && (
          <Box sx={{ mt: 4, p: 3, bgcolor: '#f5f5f5', borderRadius: 2, border: '1px solid #ddd' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#666', fontWeight: 600 }}>
              Debug Information
            </Typography>
            <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#333' }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Current Filters:</strong>
              </Typography>
              <Box sx={{ ml: 2, mb: 2 }}>
                <Typography variant="body2">Season: {season}</Typography>
                <Typography variant="body2">Email: {selectedRunner || email}</Typography>
                <Typography variant="body2">User Role: {userRole}</Typography>
                {selectedCoach && <Typography variant="body2">Coach: {selectedCoach}</Typography>}
                {userRole === 'hybrid' && <Typography variant="body2">Hybrid Toggle: {hybridToggle}</Typography>}
              </Box>
              
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>SQL Queries:</strong>
              </Typography>
              <Box sx={{ ml: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Quantitative Scores:</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
{getQuantSql(season, selectedRunner || email)}
                  </Typography>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Training Feedback:</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
SELECT meso, qual FROM rhwb_meso_scores 
WHERE season = 'Season {season}' AND email_id = '{selectedRunner || email}'
AND category = 'Personal' AND qual IS NOT NULL
ORDER BY CAST(REPLACE(meso, 'Meso ', '') AS INTEGER) DESC
                  </Typography>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Cumulative Score:</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
SELECT email_id, season, meso, cumulative_score FROM rhwb_meso_scores 
WHERE email_id = '{selectedRunner || email}' 
AND season = 'Season {season}' 
AND category = 'Personal'
                  </Typography>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Activity Summary:</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
SELECT category, percent_completed, planned, completed FROM v_activity_summary 
WHERE season = 'Season {season}' AND email_id = '{selectedRunner || email}'
                  </Typography>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Pulse Interactions:</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
SELECT value_text, value_label FROM pulse_interactions 
WHERE email_id = '{selectedRunner || email}' 
AND event_name = 'training feedback'
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
    </Box>
  );
}

export default App;
