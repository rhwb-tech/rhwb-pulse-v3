import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../components/supabaseClient';
import type { QuantitativeScoreData } from '../components/QuantitativeScores';
import type { UserRole } from '../types/user';
import type { QuantitativeScoreRow, Runner, Coach } from '../types/database';

interface Option {
  value: string;
  label: string;
}

interface DashboardDataState {
  // Widget data
  data: QuantitativeScoreData[];
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;

  // Cumulative score
  cumulativeScore: number | null;

  // Activity summary
  activitySummary: {
    mileage: { percent: number | null; planned: number | null; completed: number | null };
    strength: { percent: number | null; planned: number | null; completed: number | null };
  };

  // Training feedback
  trainingFeedback: Array<{ meso: string; qual: string }>;

  // Last data refresh date
  lastDataRefresh: string | null;

  // Data fetching functions
  fetchWidgetData: () => Promise<void>;
  fetchCumulativeScore: () => Promise<void>;
  fetchActivitySummary: () => Promise<void>;
  fetchTrainingFeedback: () => Promise<void>;

  // Lists fetching
  searchRunners: (query: string, setSearchResults: (results: Option[]) => void) => Promise<void>;
}

export const useDashboardData = (
  email: string,
  userRole: UserRole | undefined,
  season: string,
  selectedRunner: string,
  selectedCoach: string,
  hybridToggle: 'myScore' | 'myCohorts',
  coachName: string,
  setCoachList: (list: Option[]) => void,
  setRunnerList: (list: Option[]) => void,
  setCoachName: (name: string) => void
): DashboardDataState => {
  const [data, setData] = useState<QuantitativeScoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const shouldAutoFetch = useRef(false);
  
  // Track if coach list has been fetched to prevent re-fetching on re-renders
  const coachListFetchedRef = useRef(false);
  const lastFetchedRoleRef = useRef<string | null>(null);
  const isFetchingCoachesRef = useRef(false);
  
  // Track runner fetching - use a fetch ID to handle cancellation properly
  const runnerFetchIdRef = useRef(0);
  
  // Track if lists have been cleared for runner role to prevent infinite loops
  const runnerListsClearedRef = useRef(false);
  const lastRunnerRoleRef = useRef<UserRole | undefined>(undefined);

  const [cumulativeScore, setCumulativeScore] = useState<number | null>(null);
  const [activitySummary, setActivitySummary] = useState<{
    mileage: { percent: number | null; planned: number | null; completed: number | null };
    strength: { percent: number | null; planned: number | null; completed: number | null };
  }>({
    mileage: { percent: null, planned: null, completed: null },
    strength: { percent: null, planned: null, completed: null }
  });
  const [trainingFeedback, setTrainingFeedback] = useState<Array<{ meso: string; qual: string }>>([]);
  const [lastDataRefresh, setLastDataRefresh] = useState<string | null>(null);

  // Fetch last data refresh date from rhwb_dashboard_status
  useEffect(() => {
    const fetchLastDataRefresh = async () => {
      try {
        const { data, error } = await supabase
          .from('rhwb_dashboard_status')
          .select('last_activity_date, updated_at')
          .eq('id', 1)
          .single();

        if (error) {
          console.error('[DASHBOARD DATA] Error fetching last data refresh:', error);
          return;
        }

        if (data?.last_activity_date) {
          setLastDataRefresh(data.last_activity_date);
        }
      } catch (err) {
        console.error('[DASHBOARD DATA] Unexpected error fetching last data refresh:', err);
      }
    };

    fetchLastDataRefresh();
  }, []);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && email) {
        setLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [loading, email]);

  // Fetch coach name for coach/hybrid roles
  useEffect(() => {
    const fetchCoachNameInternal = async () => {
      if ((userRole === 'coach' || userRole === 'hybrid') && email) {
        try {
          const { data, error } = await supabase
            .from('rhwb_coaches')
            .select('coach')
            .eq('email_id', email);

          if (error) {
            console.error('Error fetching coach name:', error);
            setError('Unable to load coach information. Some features may be limited.');
            return;
          }

          if (data && data.length > 0) {
            setCoachName(data[0].coach);
          }
        } catch (err) {
          console.error('Unexpected error fetching coach name:', err);
          setError('Unable to load coach information. Please refresh the page.');
        }
      }
    };

    fetchCoachNameInternal();
  }, [userRole, email, setCoachName, setError]);

  // EFFECT 1: Fetch coach list for admin (only runs once per session)
  useEffect(() => {
    if (!season || !userRole) {
      return;
    }
    
    if (userRole !== 'admin') {
      return;
    }

    // Skip if already fetched or currently fetching
    if (coachListFetchedRef.current && lastFetchedRoleRef.current === 'admin') {
      console.log('[DASHBOARD DATA] Coach list already fetched for admin, skipping');
      return;
    }
    if (isFetchingCoachesRef.current) {
      console.log('[DASHBOARD DATA] Already fetching coaches, skipping');
      return;
    }

    const fetchCoachList = async () => {
      isFetchingCoachesRef.current = true;
      console.log('[DASHBOARD DATA] Fetching ALL coaches for admin...');

      try {
        const { data: coaches, error } = await supabase
          .from('rhwb_coaches')
          .select('coach');

        if (error) {
          console.error('[DASHBOARD DATA] Error fetching coaches:', error);
          setError(`Unable to load coaches: ${error.message}`);
          isFetchingCoachesRef.current = false;
          return;
        }

        const uniqueCoaches = Array.from(new Set((coaches || []).map((r: Pick<Coach, 'coach'>) => r.coach))).filter(Boolean) as string[];
        const coachOptions = uniqueCoaches.map((c) => ({ value: c, label: c })).sort((a, b) => a.label.localeCompare(b.label));
        console.log('[DASHBOARD DATA] Setting coach list:', coachOptions.length, 'coaches');
        
        setCoachList(coachOptions);
        coachListFetchedRef.current = true;
        lastFetchedRoleRef.current = 'admin';
        isFetchingCoachesRef.current = false;
      } catch (err: any) {
        isFetchingCoachesRef.current = false;
        console.error('[DASHBOARD DATA] Exception fetching coaches:', err);
        setError(`Unable to load coaches list: ${err?.message || 'Unknown error'}`);
      }
    };

    fetchCoachList();
  }, [season, userRole, setCoachList, setError]);

  // EFFECT 2: Fetch runners when admin selects a coach (runs on selectedCoach change)
  useEffect(() => {
    if (!season || userRole !== 'admin') {
      return;
    }

    if (selectedCoach) {
      // Increment fetch ID to track this specific fetch
      runnerFetchIdRef.current += 1;
      const currentFetchId = runnerFetchIdRef.current;
      
      const seasonNo = Number(season);
      console.log('[DASHBOARD DATA] Fetching runners for coach:', selectedCoach, 'season:', seasonNo, 'fetchId:', currentFetchId);

      const fetchRunners = async () => {
        try {
          const { data: runners, error: runnersError } = await supabase
            .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: selectedCoach });

          // Check if this fetch is still the current one
          if (currentFetchId !== runnerFetchIdRef.current) {
            console.log('[DASHBOARD DATA] Stale runner fetch, ignoring results');
            return;
          }

          if (runnersError) {
            console.error('[DASHBOARD DATA] Error fetching runners:', runnersError);
            setError(`Unable to load runners: ${runnersError.message}`);
            return;
          }

          const runnerOptions = (runners || []).map((r: Runner) => ({ value: r.email_id, label: r.runner_name })).sort((a: Option, b: Option) => a.label.localeCompare(b.label));
          console.log('[DASHBOARD DATA] Setting runner list:', runnerOptions.length, 'runners');
          setRunnerList(runnerOptions);
        } catch (err: any) {
          console.error('[DASHBOARD DATA] Exception fetching runners:', err);
          setError(`Unable to load runners: ${err?.message || 'Unknown error'}`);
        }
      };

      fetchRunners();
    } else {
      console.log('[DASHBOARD DATA] No coach selected, clearing runner list');
      setRunnerList([]);
    }
  }, [season, userRole, selectedCoach, setRunnerList, setError]);

  // EFFECT 3: Fetch runner lists for coach/hybrid roles
  useEffect(() => {
    if (!season || !userRole) {
      return;
    }
    
    // This effect is only for coach and hybrid roles
    if (userRole !== 'coach' && !(userRole === 'hybrid' && hybridToggle === 'myCohorts')) {
      return;
    }

    let isCancelled = false;

    const fetchRunnersForCoachRole = async () => {
      const coach = coachName;
      if (!coach) {
        setRunnerList([]);
        return;
      }
      const seasonNo = Number(season);
      console.log('[DASHBOARD DATA] Fetching runners for coach role:', coach, 'season:', seasonNo);
      
      try {
        const { data: runners, error } = await supabase
          .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: coach });

        if (isCancelled) {
          console.log('[DASHBOARD DATA] Fetch cancelled, ignoring runner results');
          return;
        }

        if (error) {
          console.error('[DASHBOARD DATA] Error fetching runners:', error);
          setError(`Unable to load runners: ${error.message}`);
          return;
        }

        const runnerOptions = (runners || []).map((r: Runner) => ({ value: r.email_id, label: r.runner_name })).sort((a: Option, b: Option) => a.label.localeCompare(b.label));
        console.log('[DASHBOARD DATA] Setting runner list:', runnerOptions.length, 'runners');
        setRunnerList(runnerOptions);
      } catch (err: any) {
        console.error('[DASHBOARD DATA] Exception fetching runners:', err);
        setError(`Unable to load runners: ${err?.message || 'Unknown error'}`);
      }
    };

    fetchRunnersForCoachRole();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, userRole, hybridToggle, coachName]);

  // EFFECT 4: Clear lists for runner role (only once when role changes to runner)
  useEffect(() => {
    // Only clear lists if role changed to runner and we haven't cleared them yet
    if (userRole === 'runner' && lastRunnerRoleRef.current !== 'runner') {
      console.log('[DASHBOARD DATA] User is runner, clearing lists');
      setCoachList([]);
      setRunnerList([]);
      runnerListsClearedRef.current = true;
      lastRunnerRoleRef.current = 'runner';
    } else if (userRole !== 'runner') {
      // Reset the flag when role changes away from runner
      runnerListsClearedRef.current = false;
      lastRunnerRoleRef.current = userRole;
    }
  }, [userRole, setCoachList, setRunnerList]);

  // Search runners for admin users
  const searchRunners = async (query: string, setSearchResults: (results: Option[]) => void) => {
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
      console.error('Error searching runners:', error);
      setError('Unable to search runners. Please try again.');
      setSearchResults([]);
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

  // Fetch widget data for a specific runner
  const fetchWidgetDataForRunner = useCallback(async (runnerEmail: string) => {
    setLoading(true);
    setError(null);

    let query = supabase.from('v_quantitative_scores').select('meso, quant_coach, quant_personal, quant_race_distance');

    if (userRole === 'admin' || userRole === 'coach') {
      if (runnerEmail) {
        query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
      } else {
        setData([]);
        setLoading(false);
        return;
      }
    } else if (userRole === 'hybrid') {
      if (hybridToggle === 'myCohorts') {
        if (runnerEmail) {
          query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
        } else {
          setData([]);
          setLoading(false);
          return;
        }
      } else {
        query = query.eq('season', `Season ${season}`).eq('email_id', email);
      }
    } else {
      query = query.eq('season', `Season ${season}`).eq('email_id', email);
    }

    const { data: rows, error } = await query;

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const formattedQuant: QuantitativeScoreData[] = (rows || []).map((row: QuantitativeScoreRow) => ({
      meso: row.meso,
      personal: row.quant_personal ?? 0,
      coach: row.quant_coach ?? 0,
      raceDistance: row.quant_race_distance ?? 0,
    }));

    setData(formattedQuant);
    setLoading(false);
  }, [season, email, userRole, hybridToggle]);

  // Fetch widget data
  const fetchWidgetData = useCallback(async () => {
    if (userRole === 'runner' || selectedRunner) {
      await fetchWidgetDataForRunner(selectedRunner || email);
    }
  }, [email, userRole, selectedRunner, fetchWidgetDataForRunner]);

  // Fetch cumulative score
  const fetchCumulativeScore = useCallback(async () => {
    const runnerEmail = selectedRunner || email;
    if (!runnerEmail) {
      setCumulativeScore(null);
      return;
    }

    const { data: rows, error } = await supabase
      .from('v_rhwb_meso_scores')
      .select('email_id, season, meso, cumulative_score')
      .eq('email_id', runnerEmail)
      .eq('season', `Season ${season}`)
      .eq('category', 'Personal');

    if (error) {
      console.error('Error fetching cumulative score:', error);
      setError('Unable to load cumulative score. Please try again.');
      setCumulativeScore(null);
      return;
    }

    if (!rows || rows.length === 0) {
      setCumulativeScore(null);
      return;
    }

    const latest = rows.reduce((max, row) => {
      const mesoNum = parseInt((row.meso || '').replace(/[^0-9]/g, ''), 10);
      const maxNum = parseInt((max.meso || '').replace(/[^0-9]/g, ''), 10);
      return mesoNum > maxNum ? row : max;
    }, rows[0]);
    setCumulativeScore(latest.cumulative_score);
  }, [selectedRunner, email, season]);

  // Fetch activity summary
  const fetchActivitySummary = useCallback(async () => {
    const runnerEmail = selectedRunner || email;
    if (!runnerEmail) {
      setActivitySummary({
        mileage: { percent: null, planned: null, completed: null },
        strength: { percent: null, planned: null, completed: null }
      });
      return;
    }

    const { data: rows, error } = await supabase
      .from('v_activity_summary')
      .select('category, percent_completed, planned, completed')
      .eq('season', `Season ${season}`)
      .eq('email_id', runnerEmail);

    if (error) {
      console.error('Error fetching activity summary:', error);
      setError('Unable to load activity summary. Please try again.');
      setActivitySummary({
        mileage: { percent: null, planned: null, completed: null },
        strength: { percent: null, planned: null, completed: null }
      });
      return;
    }

    if (!rows || rows.length === 0) {
      setActivitySummary({
        mileage: { percent: null, planned: null, completed: null },
        strength: { percent: null, planned: null, completed: null }
      });
      return;
    }

    // Aggregate totals across all mesos for each category
    let totalMileagePlanned = 0;
    let totalMileageCompleted = 0;
    let totalStrengthPlanned = 0;
    let totalStrengthCompleted = 0;

    for (const row of rows) {
      const planned = typeof row.planned === 'number' ? row.planned : parseFloat(row.planned || '0');
      const completed = typeof row.completed === 'number' ? row.completed : parseFloat(row.completed || '0');

      if (row.category === 'Mileage') {
        totalMileagePlanned += planned;
        totalMileageCompleted += completed;
      }
      if (row.category === 'Strength') {
        totalStrengthPlanned += planned;
        totalStrengthCompleted += completed;
      }
    }

    // Calculate percentages based on totals
    const mileagePercent = totalMileagePlanned > 0 
      ? Math.round((totalMileageCompleted / totalMileagePlanned) * 100 * 10) / 10 
      : 0;
    const strengthPercent = totalStrengthPlanned > 0 
      ? Math.round((totalStrengthCompleted / totalStrengthPlanned) * 100 * 10) / 10 
      : 0;

    const mileage = {
      percent: mileagePercent,
      planned: totalMileagePlanned,
      completed: totalMileageCompleted
    };

    const strength = {
      percent: strengthPercent,
      planned: totalStrengthPlanned,
      completed: totalStrengthCompleted
    };

    setActivitySummary({ mileage, strength });
  }, [selectedRunner, email, season]);

  // Fetch training feedback
  const fetchTrainingFeedback = useCallback(async () => {
    const runnerEmail = selectedRunner || email;
    if (!runnerEmail) {
      setTrainingFeedback([]);
      return;
    }

    const { data: rows, error } = await supabase
      .from('v_rhwb_meso_scores')
      .select('meso, qual')
      .eq('season', `Season ${season}`)
      .eq('email_id', runnerEmail)
      .eq('category', 'Personal')
      .not('qual', 'is', null);

    if (error) {
      console.error('Error fetching training feedback:', error);
      setError('Unable to load training feedback. Please try again.');
      setTrainingFeedback([]);
      return;
    }

    if (!rows) {
      setTrainingFeedback([]);
      return;
    }

    const sortedRows = rows.sort((a, b) => {
      const mesoA = parseInt(a.meso.replace(/[^0-9]/g, ''), 10);
      const mesoB = parseInt(b.meso.replace(/[^0-9]/g, ''), 10);
      return mesoB - mesoA;
    });
    setTrainingFeedback(sortedRows);
  }, [selectedRunner, email, season]);

  // On initial app load
  useEffect(() => {
    if (email && userRole && initialLoad) {
      if (userRole === 'runner') {
        fetchWidgetData();
      }
      setInitialLoad(false);
      shouldAutoFetch.current = true;
    }
    if (email && userRole && !initialLoad && loading) {
      if (userRole !== 'runner' && !selectedRunner) {
        setLoading(false);
      }
    }
  }, [email, userRole, initialLoad, loading, selectedRunner, fetchWidgetData]);

  // Auto-fetch data when filters change
  useEffect(() => {
    if (shouldAutoFetch.current && !initialLoad) {
      fetchWidgetData();
    }
  }, [season, selectedRunner, selectedCoach, hybridToggle, initialLoad, fetchWidgetData]);

  // Fetch cumulative score when dependencies change
  useEffect(() => {
    fetchCumulativeScore();
  }, [fetchCumulativeScore]);

  // Fetch activity summary when dependencies change
  useEffect(() => {
    fetchActivitySummary();
  }, [fetchActivitySummary]);

  // Fetch training feedback when dependencies change
  useEffect(() => {
    fetchTrainingFeedback();
  }, [fetchTrainingFeedback]);

  return {
    data,
    loading,
    error,
    setError,
    cumulativeScore,
    activitySummary,
    trainingFeedback,
    lastDataRefresh,
    fetchWidgetData,
    fetchCumulativeScore,
    fetchActivitySummary,
    fetchTrainingFeedback,
    searchRunners
  };
};
