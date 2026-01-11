import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
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

export const useFilterState = (userRole: UserRole, selectedRunnerFromProps?: string): FilterState => {
  const { setSelectedRunner: setContextSelectedRunner, setUserRole: setContextUserRole, setHybridToggle: setContextHybridToggle } = useApp();

  // Filter state
  const [season, setSeason] = useState('14'); // Default to Season 14
  const [coachList, setCoachList] = useState<Option[]>([]);
  const [runnerList, setRunnerList] = useState<Option[]>([]);
  const [selectedCoach, setSelectedCoach] = useState('');
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

  // Set hardcoded season options
  useEffect(() => {
    const hardcodedSeasons = [
      { value: '14', label: 'Season 14' },
      { value: '13', label: 'Season 13' }
    ];
    setSeasonOptions(hardcodedSeasons);
  }, []);

  // Auto-select first runner when admin selects a coach
  useEffect(() => {
    if (userRole === 'admin' && selectedCoach && runnerList.length > 0 && !selectedRunner) {
      setSelectedRunner(runnerList[0].value);
    }
  }, [userRole, selectedCoach, runnerList, selectedRunner]);

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
    setContextUserRole(userRole);
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
