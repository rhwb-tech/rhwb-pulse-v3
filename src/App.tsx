import React, { useEffect, useState, useCallback } from 'react';
import { Container, CircularProgress, Alert, Typography, Box, Grid, AppBar, Toolbar, IconButton, Drawer, Chip, Stack, Skeleton, Tabs, Tab, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import QuantitativeScores, { QuantitativeScoreData } from './components/QuantitativeScores';
import FilterPanel, { UserRole } from './components/FilterPanel';
import { supabase } from './components/supabaseClient';
import CumulativeScore from './components/CumulativeScore';
import ActivitySummary from './components/ActivitySummary';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if initial load has occurred
  const [initialLoad, setInitialLoad] = useState(true);

  // Authentication is now handled by JWT context

  // Fetch coach name for coach/hybrid roles
  useEffect(() => {
    if ((userRole === 'coach' || userRole === 'hybrid') && email) {
      supabase
        .from('rhwb_coaches')
        .select('coach')
        .eq('email_id', email)
        .then(({ data }) => {
          if (data && data.length > 0) setCoachName(data[0].coach);
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
        const seasonNo = Number(season);
        const { data: runners } = await supabase
          .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: coach });
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
    setLoading(true);
    setError(null);
    let query = supabase.from('v_quantitative_scores').select('meso, quant_coach, quant_personal, quant_race_distance');
    if (userRole === 'admin') {
      if (selectedRunner) {
        query = query.eq('season', `Season ${season}`).eq('email_id', selectedRunner);
      } else {
        setData([]); setLoading(false); return;
      }
    } else if (userRole === 'coach') {
      if (selectedRunner) {
        query = query.eq('season', `Season ${season}`).eq('email_id', selectedRunner);
      } else {
        setData([]); setLoading(false); return;
      }
    } else if (userRole === 'hybrid') {
      if (hybridToggle === 'myCohorts') {
        if (selectedRunner) {
          query = query.eq('season', `Season ${season}`).eq('email_id', selectedRunner);
        } else {
          setData([]); setLoading(false); return;
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
    const formatted: QuantitativeScoreData[] = (rows || []).map((row: any) => ({
      meso: row.meso,
      personal: row.quant_personal,
      coach: row.quant_coach,
      raceDistance: row.quant_race_distance,
    }));
    setData(formatted);
    setLoading(false);
  }, [season, email, userRole, selectedCoach, selectedRunner, hybridToggle]);

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

  // Determine which props to show in FilterPanel
  const filterPanelProps: any = {
    season,
    onSeasonChange: setSeason,
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mileagePercent, setMileagePercent] = useState<number | null>(null);
  const [strengthPercent, setStrengthPercent] = useState<number | null>(null);

  // Fetch Activity Summary data for the selected runner (or logged-in user)
  const fetchActivitySummary = useCallback(async () => {
    const runnerEmail = selectedRunner || email;
    if (!runnerEmail) {
      setMileagePercent(null);
      setStrengthPercent(null);
      return;
    }
    // Fetch activity summary for this runner and season
    const { data: rows, error } = await supabase
      .from('v_activity_summary')
      .select('category, percent_completed')
      .eq('season', `Season ${season}`)
      .eq('email_id', runnerEmail);
    if (error || !rows) {
      setMileagePercent(null);
      setStrengthPercent(null);
      return;
    }
    let mileage = null;
    let strength = null;
    for (const row of rows) {
      if (row.category === 'Mileage') mileage = row.percent_completed;
      if (row.category === 'Strength') strength = row.percent_completed;
    }
    setMileagePercent(mileage);
    setStrengthPercent(strength);
  }, [selectedRunner, email, season]);

  useEffect(() => {
    fetchActivitySummary();
  }, [fetchActivitySummary]);

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrative View';
      case 'coach': return 'Coach Dashboard';
      case 'hybrid': return 'Athlete Performance Dashboard';
      default: return 'Athlete Dashboard';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* AppBar with Hamburger Menu */}
      <AppBar position="static" color="default" elevation={1} sx={{ mb: 3 }}>
        <Toolbar>
          <IconButton 
            edge="start" 
            color="inherit" 
            aria-label="menu" 
            onClick={() => setDrawerOpen(true)} 
            sx={{ 
              mr: 2,
              minWidth: 48,
              minHeight: 48,
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
            Pulse
          </Typography>
        </Toolbar>
      </AppBar>
      {/* Selection Chips Panel */}
      <Box sx={{ 
        mb: 2, 
        display: 'flex', 
        justifyContent: 'flex-start',
        overflowX: 'auto',
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
        <Stack direction="row" spacing={2} sx={{ minWidth: 'fit-content' }}>
          <Chip
            label={`Season ${season}`}
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
          {/* Show runner chip if selected */}
          {selectedRunner && (
            <Chip
              label={runnerList.find(r => r.value === selectedRunner)?.label || selectedRunner}
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
      </Box>
      {/* Drawer for Filters */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 320, p: 2 }} role="presentation" onClick={() => setDrawerOpen(false)}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Filters
          </Typography>
          <FilterPanel {...filterPanelProps} />
        </Box>
      </Drawer>
      {/* Hybrid Tabs */}
      {userRole === 'hybrid' && (
        <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Tabs
            value={hybridToggle === 'myScore' ? 0 : 1}
            onChange={(_, val) => setHybridToggle(val === 0 ? 'myScore' : 'myCohorts')}
            aria-label="Hybrid Tabs"
            sx={{ mb: 2 }}
          >
            <Tab label="My Score" sx={{ minWidth: 120, minHeight: 48 }} />
            <Tab label="My Cohorts" sx={{ minWidth: 120, minHeight: 48 }} />
          </Tabs>
          {/* Runner list dropdown for My Cohorts */}
          {hybridToggle === 'myCohorts' && (
            <Box sx={{ minWidth: 220 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="runner-label">Runner</InputLabel>
                <Select
                  labelId="runner-label"
                  value={selectedRunner}
                  label="Runner"
                  onChange={e => handleRunnerChange(e.target.value)}
                  sx={{ minHeight: 40 }}
                >
                  {runnerList.map(opt => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ minHeight: 40 }}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {runnerList.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                  No runners available for this coach and season.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Dashboard Container with header and widgets */}
      <Box sx={{
        bgcolor: '#f7f9fb', // light gray for contrast
        borderRadius: 4,
        boxShadow: 2,
        p: { xs: 2, sm: 4 },
        mt: 2,
        maxWidth: 900,
        mx: 'auto',
      }}>
        {/* Dashboard Header */}
        <Typography
          variant="h4"
          component="h2"
          align="center"
          sx={{
            fontWeight: 700,
            color: '#1976d2',
            mb: 2,
            mt: 1,
            letterSpacing: 0.5,
            fontSize: { xs: '2rem', sm: '2.5rem', md: '2.75rem' },
          }}
        >
          Athlete Performance Dashboard
        </Typography>
        <Box sx={{ width: '100%', mb: 3 }}>
          <Box sx={{ borderBottom: '2px solid #e3f2fd', width: '80%', mx: 'auto' }} />
        </Box>
        {/* Widgets Grid */}
        {loading ? (
          <Grid container spacing={4} sx={{ mt: 1 }}>
            {/* Top row skeleton */}
            <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: '4px solid #1976d2', 
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
                borderLeft: '4px solid #1976d2', 
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
                borderLeft: '4px solid #1976d2', 
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
          <Grid container spacing={4} sx={{ mt: 1 }}>
            {/* Top row - Full width chart */}
            <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: '4px solid #1976d2', 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <QuantitativeScores data={data} />
              </Box>
            </Grid>
            {/* Bottom row - Side by side on md+ */}
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: '4px solid #1976d2', 
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
                borderLeft: '4px solid #1976d2', 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <ActivitySummary
                  mileagePercent={mileagePercent ?? 0}
                  strengthPercent={strengthPercent ?? 0}
                />
              </Box>
            </Grid>
          </Grid>
        )}
      </Box>
    </Container>
  );
}

export default App;
