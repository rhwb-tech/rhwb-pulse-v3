import React from 'react';
import { supabase } from '../components/supabaseClient';

interface Option {
  value: string;
  label: string;
}

interface MenuHandlers {
  // Season handlers
  handleSeasonMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  handleSeasonMenuClose: () => void;
  handleSeasonChange: (newSeason: string) => void;

  // Coach handlers
  handleCoachMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  handleCoachMenuClose: () => void;
  handleCoachChange: (coach: string) => void;
  handleCoachChangeFromChip: (newCoach: string) => void;

  // Runner handlers
  handleRunnerMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  handleRunnerMenuClose: () => void;
  handleRunnerChange: (runner: string) => void;
  handleRunnerChangeFromChip: (newRunner: string) => void;
  handleRunnerSelect: (runnerEmail: string) => void;

  // Hybrid toggle handlers
  handleHybridToggleMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  handleHybridToggleMenuClose: () => void;
  handleHybridToggleChangeFromChip: (newToggle: 'myScore' | 'myCohorts') => Promise<void>;

  // Search handlers
  handleSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const useMenuHandlers = (
  setSeason: (season: string) => void,
  setSelectedCoach: (coach: string) => void,
  setSelectedRunner: (runner: string) => void,
  setHybridToggle: (toggle: 'myScore' | 'myCohorts') => void,
  setSeasonMenuAnchor: (anchor: HTMLElement | null) => void,
  setCoachMenuAnchor: (anchor: HTMLElement | null) => void,
  setRunnerMenuAnchor: (anchor: HTMLElement | null) => void,
  setHybridToggleMenuAnchor: (anchor: HTMLElement | null) => void,
  setSearchQuery: (query: string) => void,
  setSearchResults: (results: Option[]) => void,
  runnerList: Option[],
  searchRunners: (query: string, setSearchResults: (results: Option[]) => void) => Promise<void>,
  userEmail: string
): MenuHandlers => {
  // Season handlers
  const handleSeasonMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSeasonMenuAnchor(event.currentTarget);
  };

  const handleSeasonMenuClose = () => {
    setSeasonMenuAnchor(null);
  };

  const handleSeasonChange = (newSeason: string) => {
    setSeason(newSeason);
    setSeasonMenuAnchor(null);
  };

  // Coach handlers
  const handleCoachMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setCoachMenuAnchor(event.currentTarget);
  };

  const handleCoachMenuClose = () => {
    setCoachMenuAnchor(null);
  };

  const handleCoachChange = (coach: string) => {
    setSelectedCoach(coach);
    // Clear runner selection - user must manually select a runner
    setSelectedRunner('');
  };

  const handleCoachChangeFromChip = (newCoach: string) => {
    setSelectedCoach(newCoach);
    setCoachMenuAnchor(null);
    // Clear runner selection - user must manually select a runner
    setSelectedRunner('');
  };

  // Runner handlers
  const handleRunnerMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setRunnerMenuAnchor(event.currentTarget);
  };

  const handleRunnerMenuClose = () => {
    setRunnerMenuAnchor(null);
  };

  const handleRunnerChange = (runner: string) => {
    setSelectedRunner(runner);
  };

  const handleRunnerChangeFromChip = (newRunner: string) => {
    setSelectedRunner(newRunner);
    setRunnerMenuAnchor(null);
  };

  const handleRunnerSelect = (runnerEmail: string) => {
    setSelectedRunner(runnerEmail);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Hybrid toggle handlers
  const handleHybridToggleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setHybridToggleMenuAnchor(event.currentTarget);
  };

  const handleHybridToggleMenuClose = () => {
    setHybridToggleMenuAnchor(null);
  };

  const handleHybridToggleChangeFromChip = async (newToggle: 'myScore' | 'myCohorts') => {
    setHybridToggle(newToggle);
    setHybridToggleMenuAnchor(null);

    if (newToggle === 'myCohorts' && runnerList.length > 0) {
      setSelectedRunner(runnerList[0].value);
    } else if (newToggle === 'myScore') {
      setSelectedRunner('');
    }

    // Log the toggle interaction
    if (userEmail) {
      try {
        await supabase
          .from('pulse_interactions')
          .insert({
            email_id: userEmail,
            event_name: 'hybrid_toggle_change',
            value_text: newToggle,
            value_label: 'dashboard_view_toggle'
          });
      } catch (error) {
        console.error('Error logging hybrid toggle interaction:', error);
      }
    }
  };

  // Search handlers
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    searchRunners(query, setSearchResults);
  };

  return {
    handleSeasonMenuOpen,
    handleSeasonMenuClose,
    handleSeasonChange,
    handleCoachMenuOpen,
    handleCoachMenuClose,
    handleCoachChange,
    handleCoachChangeFromChip,
    handleRunnerMenuOpen,
    handleRunnerMenuClose,
    handleRunnerChange,
    handleRunnerChangeFromChip,
    handleRunnerSelect,
    handleHybridToggleMenuOpen,
    handleHybridToggleMenuClose,
    handleHybridToggleChangeFromChip,
    handleSearchChange
  };
};
