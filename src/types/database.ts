// Database type definitions for RHWB Pulse v3

import { Session } from '@supabase/supabase-js';

// Coach data from rhwb_coaches table
export interface Coach {
  coach: string;
  email_id: string;
  is_active: boolean;
}

// Runner data from runner_season_info table
export interface Runner {
  email_id: string;
  runner_name: string;
  coach?: string;
  season?: string;
}

// Quantitative score data from v_quantitative_scores view
export interface QuantitativeScoreRow {
  meso: string;
  quant_coach: number | null;
  quant_personal: number | null;
  quant_race_distance: number | null;
  email_id?: string;
  season?: string;
}

// Cumulative score data from v_rhwb_meso_scores view
export interface MesoScoreRow {
  email_id: string;
  season: string;
  meso: string;
  cumulative_score: number | null;
  category: 'Personal' | 'Coach' | 'Race Distance';
  qual?: string;
}

// Activity summary data from v_activity_summary view
export interface ActivitySummaryRow {
  category: 'Mileage' | 'Strength';
  percent_completed: number | null;
  planned: number | null;
  completed: number | null;
  email_id: string;
  season: string;
}

// Filter panel props
export interface FilterPanelProps {
  season: string;
  onSeasonChange: (season: string) => void;
  userRole: 'runner' | 'coach' | 'admin' | 'hybrid';
  coachList?: Array<{ value: string; label: string }>;
  runnerList?: Array<{ value: string; label: string }>;
  selectedCoach?: string;
  selectedRunner?: string;
  onCoachChange?: (coach: string) => void;
  onRunnerChange?: (runner: string) => void;
  hybridToggle?: 'myScore' | 'myCohorts';
  onHybridToggleChange?: (toggle: 'myScore' | 'myCohorts') => void;
  searchQuery?: string;
  searchResults?: Array<{ value: string; label: string }>;
  onSearchChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRunnerSelect?: (runnerEmail: string) => void;
}
