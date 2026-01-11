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
  userRole: UserRole,
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

  const [cumulativeScore, setCumulativeScore] = useState<number | null>(null);
  const [activitySummary, setActivitySummary] = useState<{
    mileage: { percent: number | null; planned: number | null; completed: number | null };
    strength: { percent: number | null; planned: number | null; completed: number | null };
  }>({
    mileage: { percent: null, planned: null, completed: null },
    strength: { percent: null, planned: null, completed: null }
  });
  const [trainingFeedback, setTrainingFeedback] = useState<Array<{ meso: string; qual: string }>>([]);

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

  // Fetch coach/runner lists based on role, season, and selection
  useEffect(() => {
    if (!season) return;
    const fetchLists = async () => {
      if (userRole === 'admin') {
        const { data: coaches } = await supabase
          .from('rhwb_coaches')
          .select('coach')
          .eq('status', 'Active');
        const uniqueCoaches = Array.from(new Set((coaches || []).map((r: Pick<Coach, 'coach'>) => r.coach))).filter(Boolean);
        const coachOptions = uniqueCoaches.map((c: string) => ({ value: c, label: c })).sort((a: Option, b: Option) => a.label.localeCompare(b.label));
        setCoachList(coachOptions);

        if (selectedCoach) {
          const seasonNo = Number(season);
          const { data: runners } = await supabase
            .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: selectedCoach });
          const runnerOptions = (runners || []).map((r: Runner) => ({ value: r.email_id, label: r.runner_name })).sort((a: Option, b: Option) => a.label.localeCompare(b.label));
          setRunnerList(runnerOptions);
        } else {
          setRunnerList([]);
        }
      } else if (userRole === 'coach' || (userRole === 'hybrid' && hybridToggle === 'myCohorts')) {
        const coach = coachName;
        if (!coach) {
          setRunnerList([]);
          return;
        }
        const seasonNo = Number(season);
        const { data: runners } = await supabase
          .rpc('fetch_runners_for_coach', { season_no_parm: seasonNo, coach_name_parm: coach });
        setRunnerList((runners || []).map((r: Runner) => ({ value: r.email_id, label: r.runner_name })).sort((a: Option, b: Option) => a.label.localeCompare(b.label)));
      } else {
        setCoachList([]);
        setRunnerList([]);
      }
    };
    fetchLists();
  }, [season, userRole, selectedCoach, email, hybridToggle, coachName, setCoachList, setRunnerList]);

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
    if (userRole === 'athlete' || selectedRunner) {
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

    if (!rows) {
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
      if (userRole === 'athlete') {
        fetchWidgetData();
      }
      setInitialLoad(false);
      shouldAutoFetch.current = true;
    }
    if (email && userRole && !initialLoad && loading) {
      if (userRole !== 'athlete' && !selectedRunner) {
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
    fetchWidgetData,
    fetchCumulativeScore,
    fetchActivitySummary,
    fetchTrainingFeedback,
    searchRunners
  };
};
