import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Typography, Box, Grid, Chip, Stack, Skeleton, MenuItem, Menu, ListItemText, TextField } from '@mui/material';
import QuantitativeScores, { QuantitativeScoreData } from './components/QuantitativeScores';
// import QuantitativeScoresMobile, { QuantitativeScoreMobileData } from './components/QuantitativeScoresMobile';
// import ActiveMinutes, { ActiveMinutesData } from './components/ActiveMinutes';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { UserRole } from './components/FilterPanel';
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

function App() {
  const { user } = useAuth();
  
  // Filter state
  const [season, setSeason] = useState('14'); // Default to Season 14
  const email = user?.email || '';
  const userRole = user?.role || 'athlete';
  const [coachList, setCoachList] = useState<Option[]>([]);
  const [runnerList, setRunnerList] = useState<Option[]>([]);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedRunner, setSelectedRunner] = useState('');
  const [hybridToggle, setHybridToggle] = useState<'myScore' | 'myCohorts'>('myCohorts');
  const [coachName, setCoachName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Option[]>([]);

  // Widget data
  const [data, setData] = useState<QuantitativeScoreData[]>([]);
  // const [qualitativeData, setQualitativeData] = useState<QuantitativeScoreMobileData[]>([]);
  // const [activeMinutesData, setActiveMinutesData] = useState<ActiveMinutesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if initial load has occurred
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && email) {
        setLoading(false);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, [loading, email]);
  
  // Season dropdown state
  const [seasonMenuAnchor, setSeasonMenuAnchor] = useState<null | HTMLElement>(null);
  const seasonMenuOpen = Boolean(seasonMenuAnchor);
  const [seasonOptions, setSeasonOptions] = useState<Option[]>([]);
  
  // Coach dropdown state
  const [coachMenuAnchor, setCoachMenuAnchor] = useState<null | HTMLElement>(null);
  const coachMenuOpen = Boolean(coachMenuAnchor);
  
  // Runner dropdown state
  const [runnerMenuAnchor, setRunnerMenuAnchor] = useState<null | HTMLElement>(null);
  const runnerMenuOpen = Boolean(runnerMenuAnchor);
  
  // Hybrid toggle dropdown state
  const [hybridToggleMenuAnchor, setHybridToggleMenuAnchor] = useState<null | HTMLElement>(null);
  const hybridToggleMenuOpen = Boolean(hybridToggleMenuAnchor);

  // Debug mode state from URL parameter
  const [showDebug, setShowDebug] = useState(false);

  // Responsive breakpoint for mobile detection
  // const isMobile = useMediaQuery('(max-width:768px)');

  // Authentication is now handled by JWT context



  // Set hardcoded season options
  useEffect(() => {
    const hardcodedSeasons = [
      { value: '14', label: 'Season 14' },
      { value: '13', label: 'Season 13' }
    ];
    setSeasonOptions(hardcodedSeasons);
  }, []);

  // Search runners for admin users
  const searchRunners = async (query: string) => {
    if (!query.trim() || userRole !== 'admin') {
      setSearchResults([]);
      return;
    }

    const { data: runners, error } = await supabase
      .from('v_rhwb_meso_scores')
      .select('email_id, full_name')
      .or(`email_id.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(10);

    if (error) {
      return;
    }

    const uniqueRunners = Array.from(new Set(runners?.map(r => r.email_id) || []))
      .map(emailId => {
        const runner = runners?.find(r => r.email_id === emailId);
        return {
          value: emailId,
          label: runner?.full_name || emailId
        };
      });

    setSearchResults(uniqueRunners.sort((a: Option, b: Option) => a.label.localeCompare(b.label)));
  };



  // Fetch coach name for coach/hybrid roles
  useEffect(() => {
    if ((userRole === 'coach' || userRole === 'hybrid') && email) {
      supabase
        .from('rhwb_coaches')
        .select('coach')
        .eq('email_id', email)
        .then(({ data, error }) => {
                  if (error) {
          // Error fetching coach name
        }
                  if (data && data.length > 0) {
          setCoachName(data[0].coach);
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
        const { data: coaches } = await supabase
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
          setRunnerList((runners || []).map((r: any) => ({ value: r.email_id, label: r.runner_name })).sort((a: Option, b: Option) => a.label.localeCompare(b.label)));
        } else {
          setRunnerList([]);
        }
      } else if (userRole === 'coach' || (userRole === 'hybrid' && hybridToggle === 'myCohorts')) {
        // Coach/Hybrid: fetch runners using the new join query (a.coach)
        const coach = coachName;
        if (!coach) {
          setRunnerList([]);
          return;
        }
        const seasonNo = Number(season);
        const { data: runners, error: runnersError } = await supabase
          .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: coach });
        
        if (runnersError) {
          setRunnerList([]);
          return;
        }
        
        setRunnerList((runners || []).map((r: any) => ({ value: r.email_id, label: r.runner_name })).sort((a: Option, b: Option) => a.label.localeCompare(b.label)));
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
    // Only fetch if we have a valid selectedRunner (for non-athlete roles)
    if (userRole === 'athlete' || selectedRunner) {
      await fetchWidgetDataForRunner(selectedRunner || email);
    }
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
        // setQualitativeData([]);
        // setActiveMinutesData([]);
        setLoading(false); 
        return;
      }
    } else if (userRole === 'coach') {
      if (runnerEmail) {
        query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
      } else {
        setData([]); 
        // setQualitativeData([]);
        // setActiveMinutesData([]);
        setLoading(false); 
        return;
      }
    } else if (userRole === 'hybrid') {
      if (hybridToggle === 'myCohorts') {
        if (runnerEmail) {
          query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
        } else {
          setData([]); 
          // setQualitativeData([]);
          // setActiveMinutesData([]);
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
    // const formattedQual: QuantitativeScoreMobileData[] = (rows || []).map((row: any) => ({
    //   meso: row.meso,
    //   personal: row.quant_personal, // Using same data for now
    //   coach: row.quant_coach,       // Using same data for now
    //   raceDistance: row.quant_race_distance, // Using same data for now
    // }));
    
    setData(formattedQuant);
    // setQualitativeData(formattedQual);
    
    // Fetch active minutes data - commented out since widget is hidden
    // let activeMinutesQuery = supabase
    //   .from('rhwb_activities_summary')
    //   .select('meso, workout_date, activity, completed_time_in_mins');
    
    // if (userRole === 'admin') {
    //   if (runnerEmail) {
    //     activeMinutesQuery = activeMinutesQuery.eq('email_id', runnerEmail);
    //   } else {
    //     setActiveMinutesData([]);
    //     setLoading(false);
    //     return;
    //   }
    // } else if (userRole === 'coach') {
    //   if (runnerEmail) {
    //     activeMinutesQuery = activeMinutesQuery.eq('email_id', runnerEmail);
    //   } else {
    //     setActiveMinutesData([]);
    //     setLoading(false);
    //     return;
    //   }
    // } else if (userRole === 'hybrid') {
    //   if (hybridToggle === 'myCohorts') {
    //     if (runnerEmail) {
    //       activeMinutesQuery = activeMinutesQuery.eq('email_id', runnerEmail);
    //     } else {
    //       setActiveMinutesData([]);
    //       setLoading(false);
    //       return;
    //     }
    //   } else {
    //     activeMinutesQuery = activeMinutesQuery.eq('email_id', email);
    //   }
    // } else {
    //   // athlete
    //   activeMinutesQuery = activeMinutesQuery.eq('email_id', email);
    // }
    
    // const { data: activeMinutesRows, error: activeMinutesError } = await activeMinutesQuery;
    
    // if (activeMinutesError) {
    //   console.error('Error fetching active minutes data:', activeMinutesError);
    //   setActiveMinutesData([]);
    // } else {
    //   const formattedActiveMinutes: ActiveMinutesData[] = (activeMinutesRows || []).map((row: any) => ({
    //     meso: row.meso,
    //     workout_date: row.workout_date,
    //     activity: row.activity,
    //     completed_time_in_mins: row.completed_time_in_mins,
    //   }));
    //   setActiveMinutesData(formattedActiveMinutes);
    // }
    
    setLoading(false);
  }, [season, email, userRole, hybridToggle]);

  // On initial app load or when email changes from URL, fetch Quantitative Scores
  useEffect(() => {
    if (email && userRole && initialLoad) {
      // Only fetch data immediately for athletes, others wait for runner selection
      if (userRole === 'athlete') {
        fetchWidgetData();
      }
      setInitialLoad(false);
    }
    // Ensure loading is set to false if we have user info but no data fetching is needed
    if (email && userRole && !initialLoad && loading) {
      // For non-athlete users, if we have user info but no runner selected, still stop loading
      if (userRole !== 'athlete' && !selectedRunner) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line
  }, [email, userRole, initialLoad, loading, selectedRunner]);

  // Handle initial load for hybrid users who start with 'myCohorts'
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myCohorts' && runnerList.length > 0 && !selectedRunner && !initialLoad) {
      setSelectedRunner(runnerList[0].value);
    }
    // eslint-disable-next-line
  }, [userRole, runnerList, initialLoad, hybridToggle]);

  // When selectedRunner changes, fetch widget data
  useEffect(() => {
    if (selectedRunner || userRole === 'athlete') {
      fetchWidgetData();
    }
    // eslint-disable-next-line
  }, [selectedRunner, userRole]);

  // When hybrid user selects 'My Score', clear runner selection and filter widget data for logged-in user
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myScore') {
      setSelectedRunner('');
    }
    // eslint-disable-next-line
  }, [hybridToggle]);

  // When hybrid user selects 'My Cohorts', select the first runner and filter widget data
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myCohorts' && runnerList.length > 0 && !selectedRunner) {
      setSelectedRunner(runnerList[0].value);
    }
    // eslint-disable-next-line
  }, [hybridToggle, runnerList]);

  // When coach user loads, auto-select the first runner
  useEffect(() => {
    if (userRole === 'coach' && runnerList.length > 0 && !selectedRunner) {
      setSelectedRunner(runnerList[0].value);
    }
    // eslint-disable-next-line
  }, [userRole, runnerList]);

  // When admin selects a coach, auto-select the first runner for that coach
  useEffect(() => {
    if (userRole === 'admin' && selectedCoach && runnerList.length > 0) {
      setSelectedRunner(runnerList[0].value);
    }
    // eslint-disable-next-line
  }, [userRole, selectedCoach, runnerList]);

  // When season changes and hybrid user is in 'myCohorts' mode, auto-select first runner
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myCohorts' && runnerList.length > 0 && !selectedRunner) {
      setSelectedRunner(runnerList[0].value);
    }
    // eslint-disable-next-line
  }, [season, userRole, hybridToggle, runnerList, selectedRunner]);

  // Ensure hybrid users in 'myCohorts' mode always have a runner from their list selected
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myCohorts' && runnerList.length > 0) {
      // Check if selectedRunner is not in the runnerList (i.e., it's the coach's email)
      const isRunnerInList = runnerList.some(runner => runner.value === selectedRunner);
      if (!isRunnerInList) {
        setSelectedRunner(runnerList[0].value);
      }
    }
    // eslint-disable-next-line
  }, [userRole, hybridToggle, runnerList, selectedRunner]);

  // Handle Apply
  const handleApply = () => {
    fetchWidgetData();
  };

  // Handle Clear All
  const handleClear = () => {
    setSeason(DEFAULT_SEASON);
    setSelectedCoach('');
    setSelectedRunner('');
    setHybridToggle('myCohorts');
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

  // Coach dropdown handlers
  const handleCoachMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setCoachMenuAnchor(event.currentTarget);
  };

  const handleCoachMenuClose = () => {
    setCoachMenuAnchor(null);
  };

  const handleCoachChangeFromChip = (newCoach: string) => {
    setSelectedCoach(newCoach);
    setCoachMenuAnchor(null);
    setTimeout(() => {
      if (runnerList.length > 0) {
        setSelectedRunner(runnerList[0].value);
        setTimeout(() => handleApply(), 0);
      } else {
        setSelectedRunner('');
        handleApply();
      }
    }, 0);
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

  // Handle search input changes
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    searchRunners(query);
  };

  // Handle runner selection from search
  const handleRunnerSelect = (runnerEmail: string) => {
    setSelectedRunner(runnerEmail);
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => handleApply(), 0);
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
          // Error logging hybrid toggle interaction
        }
      } catch (err) {
        // Error logging hybrid toggle interaction
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
      .from('v_rhwb_meso_scores')
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
      .from('v_rhwb_meso_scores')
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
            // Error logging app access
          }
        } catch (err) {
          // Error logging app access
        }
      }
    };

    logAppAccess();
  }, [user?.email]); // Only run when user email changes (i.e., when user logs in)





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
            
            {/* Coach menu for admin users */}
            {userRole === 'admin' && (
              <Menu
                anchorEl={coachMenuAnchor}
                open={coachMenuOpen}
                onClose={handleCoachMenuClose}
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
                {coachList.map((coachOption) => (
                  <MenuItem
                    key={coachOption.value}
                    onClick={() => handleCoachChangeFromChip(coachOption.value)}
                    selected={selectedCoach === coachOption.value}
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
                    <ListItemText primary={coachOption.label} />
                  </MenuItem>
                ))}
              </Menu>
            )}
            
            {/* Show coach chip for admin if selected */}
            {userRole === 'admin' && selectedCoach && (
              <Chip
                label={selectedCoach}
                onClick={handleCoachMenuOpen}
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
            
            {/* Show coach selection chip for admin if no coach selected */}
            {userRole === 'admin' && !selectedCoach && coachList.length > 0 && (
              <Chip
                label="Select Coach"
                onClick={handleCoachMenuOpen}
                sx={{
                  bgcolor: '#f5f5f5',
                  color: '#666',
                  fontWeight: 600,
                  fontSize: { xs: 14, sm: 16, md: 18 },
                  borderRadius: 999,
                  px: 2,
                  py: 1,
                  minWidth: 'fit-content',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: '2px dashed #ccc',
                  '&:hover': {
                    bgcolor: '#e0e0e0',
                    borderColor: '#999',
                  },
                }}
              />
            )}
            
            {/* Search box for admin users */}
            {userRole === 'admin' && (
              <Box sx={{ position: 'relative', minWidth: 200 }}>
                <TextField
                  size="small"
                  placeholder="Search runner by name or email..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      fontSize: { xs: 14, sm: 16 },
                      minHeight: 40,
                    },
                  }}
                />
                {searchResults.length > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      bgcolor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      zIndex: 1000,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {searchResults.map((runner) => (
                      <Box
                        key={runner.value}
                        onClick={() => handleRunnerSelect(runner.value)}
                        sx={{
                          p: 1,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: '#f5f5f5',
                          },
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {runner.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          {runner.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Stack>
          
          {/* Second Row - Runner Chip (Mobile) or Same Row (Desktop) */}
          {selectedRunner && (userRole === 'admin' || userRole === 'coach' || userRole === 'hybrid') && (
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
          {(userRole === 'admin' || userRole === 'coach' || userRole === 'hybrid') && (
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
          )}
        </Stack>
      </Box>



      {/* Widgets Grid */}
        {/* Widgets Grid */}
        {loading ? (
          <Grid container spacing={{ xs: 1, sm: 2, md: 4 }} sx={{ mt: { xs: 0, sm: 1 } }}>
            {/* Top row skeletons - side by side on desktop */}
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
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="rectangular" width="100%" height={280} sx={{ mt: 2 }} />
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
            {/* Top row - Quantitative Scores (full width since Active Minutes is hidden) */}
            <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1,
                display: 'block'
              }}>
                <QuantitativeScores data={data} />
              </Box>
            </Grid>
            {/* <Grid item xs={12} md={6}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1,
                display: isMobile ? 'none' : 'block'
              }}>
                <ActiveMinutes data={activeMinutesData} />
              </Box>
            </Grid> */}
            {/* Mobile Quantitative Score - Full width vertical chart */}
            {/* <Grid item xs={12}>
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
            </Grid> */}
            {/* Mobile Active Minutes - Full width */}
            {/* <Grid item xs={12}>
              <Box sx={{ 
                width: '100%', 
                borderLeft: { xs: 'none', sm: '4px solid #1976d2' }, 
                borderRadius: 2, 
                bgcolor: 'white',
                overflow: 'hidden',
                boxShadow: 1,
                display: isMobile ? 'block' : 'none'
              }}>
                <ActiveMinutes data={activeMinutesData} />
              </Box>
            </Grid> */}
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
                <Typography variant="body2">Data Length: {data.length}</Typography>
                <Typography variant="body2">Loading: {loading ? 'true' : 'false'}</Typography>
                <Typography variant="body2">Error: {error || 'none'}</Typography>
              </Box>
              
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>SQL Queries:</strong>
              </Typography>
              <Box sx={{ ml: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Quantitative Scores (v_quantitative_scores view):</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
SELECT meso, quant_coach, quant_personal, quant_race_distance 
FROM v_quantitative_scores 
WHERE season = 'Season {season}' AND email_id = '{selectedRunner || email}'
                  </Typography>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Quantitative Scores (direct table query):</strong>
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
SELECT meso, qual FROM v_rhwb_meso_scores 
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
SELECT email_id, season, meso, cumulative_score FROM v_rhwb_meso_scores 
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
                  <strong>Active Minutes:</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
SELECT meso, workout_date, activity, sum(completed_time_in_mins) FROM rhwb_activities_summary 
WHERE email_id = '{selectedRunner || email}'
GROUP BY meso, workout_date, activity
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
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Chart Data (formattedQuant):</strong>
                </Typography>
                <Box sx={{ ml: 2, mb: 2, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #ccc' }}>
                  <Typography variant="body2" component="pre" sx={{ margin: 0, whiteSpace: 'pre-wrap' }}>
{JSON.stringify(data, null, 2)}
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
