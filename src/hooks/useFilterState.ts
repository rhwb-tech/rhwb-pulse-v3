import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../components/supabaseClient';
import type { UserRole } from '../types/user';

interface Option {
  value: string;
  label: string;
}

export interface FilterState {
  // Filter values
  season: string;
  setSeason: (season: string) => void;
  selectedCoach: string;
  setSelectedCoach: (coach: string) => void;
  selectedRunner: string;
  setSelectedRunner: (runner: string) => void;
  hybridToggle: 'myScore' | 'myCohorts';
  setHybridToggle: (toggle: 'myScore' | 'myCohorts') => void;

  // Lists
  coachList: Option[];
  setCoachList: (list: Option[]) => void;
  runnerList: Option[];
  setRunnerList: (list: Option[]) => void;
  seasonOptions: Option[];

  // Coach name for coach/hybrid users
  coachName: string;
  setCoachName: (name: string) => void;

  // Admin search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Option[];
  setSearchResults: (results: Option[]) => void;

  // Menu states
  seasonMenuAnchor: HTMLElement | null;
  setSeasonMenuAnchor: (anchor: HTMLElement | null) => void;
  seasonMenuOpen: boolean;

  coachMenuAnchor: HTMLElement | null;
  setCoachMenuAnchor: (anchor: HTMLElement | null) => void;
  coachMenuOpen: boolean;

  runnerMenuAnchor: HTMLElement | null;
  setRunnerMenuAnchor: (anchor: HTMLElement | null) => void;
  runnerMenuOpen: boolean;

  hybridToggleMenuAnchor: HTMLElement | null;
  setHybridToggleMenuAnchor: (anchor: HTMLElement | null) => void;
  hybridToggleMenuOpen: boolean;
}

// Helper to get cached coach list from sessionStorage
const getCachedCoachList = (): Option[] => {
  try {
    const cached = sessionStorage.getItem('rhwb-pulse-coach-list');
    if (cached) {
      const parsed = JSON.parse(cached);
      console.log('[FILTER STATE] Loaded coach list from cache:', parsed.length, 'coaches');
      return parsed;
    }
  } catch (err) {
    console.error('[FILTER STATE] Error loading coach list from cache:', err);
  }
  return [];
};

// Helper to save coach list to sessionStorage
const saveCachedCoachList = (list: Option[]): void => {
  try {
    sessionStorage.setItem('rhwb-pulse-coach-list', JSON.stringify(list));
    console.log('[FILTER STATE] Saved coach list to cache:', list.length, 'coaches');
  } catch (err) {
    console.error('[FILTER STATE] Error saving coach list to cache:', err);
  }
};

export const useFilterState = (userRole: UserRole | undefined, selectedRunnerFromProps?: string): FilterState => {
  const { setSelectedRunner: setContextSelectedRunner, setUserRole: setContextUserRole, setHybridToggle: setContextHybridToggle } = useApp();

  // Filter state - initialize coachList from sessionStorage cache
  const [season, setSeason] = useState(''); // Will be set to most recent season after fetch
  const [coachList, setCoachListInternal] = useState<Option[]>(getCachedCoachList);
  const seasonFetchedRef = useRef(false); // Track if seasons have been fetched
  const [runnerList, setRunnerList] = useState<Option[]>([]);
  const [selectedCoach, setSelectedCoach] = useState('');
  
  // Wrapper for setCoachList that also saves to cache - memoized to prevent infinite loops
  const setCoachList = useCallback((list: Option[]) => {
    setCoachListInternal(list);
    if (list.length > 0) {
      saveCachedCoachList(list);
    }
  }, []);
  const [selectedRunner, setSelectedRunner] = useState('');
  const [hybridToggle, setHybridToggle] = useState<'myScore' | 'myCohorts'>('myCohorts');
  const [coachName, setCoachName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Option[]>([]);

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

  // Fetch season options from database
  useEffect(() => {
    if (seasonFetchedRef.current) {
      return;
    }

    const fetchSeasons = async () => {
      try {
        console.log('[FILTER STATE] Fetching seasons from database...');

        // Query distinct seasons using RPC function
        // This is more efficient than sampling from multiple offsets
        const { data, error } = await supabase.rpc('get_distinct_seasons');
        const seasonData = data as { season: string }[] | null;
        
        if (error) {
          console.error('[FILTER STATE] Error fetching seasons:', error);
          const fallbackSeasons = [
            { value: '14', label: 'Season 14' },
            { value: '13', label: 'Season 13' }
          ];
          setSeasonOptions(fallbackSeasons);
          setSeason('14');
          return;
        }

        if (!seasonData || seasonData.length === 0) {
          console.warn('[FILTER STATE] No seasons found in database');
          const fallbackSeasons = [
            { value: '14', label: 'Season 14' },
            { value: '13', label: 'Season 13' }
          ];
          setSeasonOptions(fallbackSeasons);
          setSeason('14');
          return;
        }

        // RPC function already returns distinct seasons, sorted descending
        // Extract season number from "Season X" format and format for dropdown
        const seasonOpts = seasonData
          .filter(row => row.season) // Filter out any null/empty values
          .map(row => {
            const seasonStr = row.season;
            const match = seasonStr.match(/Season\s+(\d+)/i);
            const seasonNum = match ? match[1] : seasonStr;
            return {
              value: seasonNum,
              label: seasonStr
            };
          });

        console.log('[FILTER STATE] Loaded seasons from RPC:', seasonOpts);

        setSeasonOptions(seasonOpts);

        // Set default to most recent season (first in the sorted list)
        if (seasonOpts.length > 0) {
          console.log('[FILTER STATE] Setting default season to:', seasonOpts[0].value);
          setSeason(seasonOpts[0].value);
        }

        seasonFetchedRef.current = true;
      } catch (err) {
        console.error('[FILTER STATE] Exception fetching seasons:', err);
        // Fallback to hardcoded seasons
        const fallbackSeasons = [
          { value: '14', label: 'Season 14' },
          { value: '13', label: 'Season 13' }
        ];
        setSeasonOptions(fallbackSeasons);
        setSeason('14');
      }
    };

    fetchSeasons();
  }, []);

  // Don't auto-select runner when coach is selected - wait for user to choose

  // Auto-select first runner when coach user loads
  useEffect(() => {
    if (userRole === 'coach' && runnerList.length > 0 && !selectedRunner) {
      setSelectedRunner(runnerList[0].value);
    }
  }, [userRole, runnerList, selectedRunner]);

  // Auto-select first runner when hybrid user is in 'myCohorts' mode
  useEffect(() => {
    if (userRole === 'hybrid' && hybridToggle === 'myCohorts' && runnerList.length > 0 && !selectedRunner) {
      setSelectedRunner(runnerList[0].value);
    }
  }, [userRole, hybridToggle, runnerList, selectedRunner]);

  // Sync selectedRunner, userRole, and hybridToggle to context for ProtectedRoute to access
  useEffect(() => {
    setContextSelectedRunner(selectedRunner);
  }, [selectedRunner, setContextSelectedRunner]);

  useEffect(() => {
    // Only update context when userRole is defined (not during loading)
    if (userRole) {
      setContextUserRole(userRole);
    }
  }, [userRole, setContextUserRole]);

  useEffect(() => {
    setContextHybridToggle(hybridToggle);
  }, [hybridToggle, setContextHybridToggle]);

  return {
    season,
    setSeason,
    selectedCoach,
    setSelectedCoach,
    selectedRunner,
    setSelectedRunner,
    hybridToggle,
    setHybridToggle,
    coachList,
    setCoachList,
    runnerList,
    setRunnerList,
    seasonOptions,
    coachName,
    setCoachName,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    seasonMenuAnchor,
    setSeasonMenuAnchor,
    seasonMenuOpen,
    coachMenuAnchor,
    setCoachMenuAnchor,
    coachMenuOpen,
    runnerMenuAnchor,
    setRunnerMenuAnchor,
    runnerMenuOpen,
    hybridToggleMenuAnchor,
    setHybridToggleMenuAnchor,
    hybridToggleMenuOpen
  };
};
