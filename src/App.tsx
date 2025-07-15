import React, { useEffect, useState, useCallback } from 'react';
import { Container, CircularProgress, Alert, Typography, Box, Grid } from '@mui/material';
import QuantitativeScores, { QuantitativeScoreData } from './components/QuantitativeScores';
import FilterPanel, { UserRole } from './components/FilterPanel';
import { supabase } from './components/supabaseClient';
import CumulativeScore from './components/CumulativeScore';
import ActivitySummary from './components/ActivitySummary';

interface Option {
  value: string;
  label: string;
}

const DEFAULT_SEASON = '13';

function getQuantSql(season: string, email: string) {
  return `SELECT meso, max(case when category='Personal' then quant end)  as quant_personal,\n       max(case when category='Race Distance' then quant end) as quant_race_distance,\n       max(case when category='Coach' then quant end) as quant_coach\n       FROM rhwb_meso_scores where season = '${season ? `Season ${season}` : ''}' and email_id = '${email}'\nGROUP BY meso`;
}

function getEmailFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('email') || '';
}

const SESSION_EMAIL_KEY = 'pulse_email_id';
const SESSION_ROLE_KEY = 'pulse_user_role';

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
  // Filter state
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('athlete');
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

  // Parse email from sessionStorage or URL on initial load and update session if URL changes
  useEffect(() => {
    const urlEmail = getEmailFromUrl();
    const sessionEmail = sessionStorage.getItem(SESSION_EMAIL_KEY);
    if (urlEmail && urlEmail !== sessionEmail) {
      setEmail(urlEmail);
      sessionStorage.setItem(SESSION_EMAIL_KEY, urlEmail);
      // Clear role so it will be refetched for the new email
      sessionStorage.removeItem(SESSION_ROLE_KEY);
    } else if (sessionEmail) {
      setEmail(sessionEmail);
    }
  }, [window.location.search]);

  // Fetch user role
  useEffect(() => {
    if (!email) return;
    const sessionRole = sessionStorage.getItem(SESSION_ROLE_KEY);
    if (sessionRole) {
      setUserRole(sessionRole as UserRole);
      return;
    }
    const fetchRole = async () => {
      const { data: roles, error } = await supabase.from('v_pulse_roles').select('*').eq('email_id', email);
      if (error) {
        setUserRole('athlete');
        sessionStorage.setItem(SESSION_ROLE_KEY, 'athlete');
        return;
      }
      if (roles && roles.length > 0) {
        setUserRole(roles[0].role as UserRole);
        sessionStorage.setItem(SESSION_ROLE_KEY, roles[0].role);
      } else {
        setUserRole('athlete');
        sessionStorage.setItem(SESSION_ROLE_KEY, 'athlete');
      }
    };
    fetchRole();
  }, [email]);

  // Fetch coach name for coach/hybrid roles
  useEffect(() => {
    let sessionEmail = sessionStorage.getItem(SESSION_EMAIL_KEY);
    if ((userRole === 'coach' || userRole === 'hybrid') && sessionEmail) {
      supabase
        .from('rhwb_coaches')
        .select('coach')
        .eq('email_id', sessionEmail)
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

  const sessionRole = sessionStorage.getItem(SESSION_ROLE_KEY) as UserRole | null;
  const effectiveRole = sessionRole || userRole;

  // When admin selects a coach, auto-select the first runner for that coach
  useEffect(() => {
    if (effectiveRole === 'admin' && selectedCoach && runnerList.length > 0) {
      setSelectedRunner(runnerList[0].value);
    }
    // eslint-disable-next-line
  }, [effectiveRole, selectedCoach, runnerList]);

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
    // Reset email to session or URL param
    const sessionEmail = sessionStorage.getItem(SESSION_EMAIL_KEY);
    if (sessionEmail) {
      setEmail(sessionEmail);
    } else {
      setEmail(getEmailFromUrl());
    }
    // Optionally clear role from session
    // sessionStorage.removeItem(SESSION_ROLE_KEY);
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
    userRole: effectiveRole,
  };
  if (effectiveRole === 'admin') {
    filterPanelProps.coachList = coachList;
    filterPanelProps.onCoachChange = handleCoachChange;
    filterPanelProps.selectedCoach = selectedCoach;
    filterPanelProps.runnerList = runnerList;
    filterPanelProps.onRunnerChange = handleRunnerChange;
    filterPanelProps.selectedRunner = selectedRunner;
    filterPanelProps.onEmailChange = setEmail;
  } else if (effectiveRole === 'coach') {
    filterPanelProps.runnerList = runnerList;
    filterPanelProps.onRunnerChange = handleRunnerChange;
    filterPanelProps.selectedRunner = selectedRunner;
    filterPanelProps.onEmailChange = () => {};
  } else if (effectiveRole === 'hybrid') {
    filterPanelProps.hybridToggle = hybridToggle;
    filterPanelProps.onHybridToggle = setHybridToggle;
    filterPanelProps.runnerList = hybridToggle === 'myCohorts' ? runnerList : [];
    filterPanelProps.onRunnerChange = hybridToggle === 'myCohorts' ? handleRunnerChange : () => {};
    filterPanelProps.selectedRunner = selectedRunner;
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

  // Activity Summary state
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

  // Fetch activity summary when runner, email, or season changes
  useEffect(() => {
    fetchActivitySummary();
  }, [fetchActivitySummary]);

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrative View';
      case 'coach': return 'Coach Dashboard';
      case 'hybrid': return 'Coach & Athlete View';
      default: return 'Athlete Dashboard';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Athlete Performance Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {getRoleDisplayName(effectiveRole)}
        </Typography>
      </Box>

      <FilterPanel {...filterPanelProps} />
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>
      ) : (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Top row - Main chart */}
          <Grid item xs={12}>
            <QuantitativeScores data={data} />
          </Grid>
          {/* Bottom row - Two smaller widgets */}
          <Grid item xs={12} md={6}>
            <CumulativeScore score={cumulativeScore ?? 0} target={5} />
          </Grid>
          <Grid item xs={12} md={6}>
            <ActivitySummary
              mileagePercent={mileagePercent ?? 0}
              strengthPercent={strengthPercent ?? 0}
            />
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

export default App;
