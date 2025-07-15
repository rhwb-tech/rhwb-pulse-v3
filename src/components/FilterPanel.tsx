import React from 'react';
import {
  Box, FormControl, InputLabel, Select, MenuItem, Stack, Typography, TextField, Tabs, Tab
} from '@mui/material';

export type UserRole = 'admin' | 'coach' | 'hybrid' | 'athlete';

interface Option {
  value: string;
  label: string;
}

interface FilterPanelProps {
  season: string;
  onSeasonChange: (value: string) => void;
  userRole: UserRole;
  coachList?: Option[];
  runnerList?: Option[];
  selectedCoach?: string;
  onCoachChange?: (value: string) => void;
  selectedRunner?: string;
  onRunnerChange?: (value: string) => void;
  hybridToggle?: 'myScore' | 'myCohorts';
  onHybridToggle?: (value: 'myScore' | 'myCohorts') => void;
  email?: string;
  onEmailChange?: (value: string) => void;
}

const SEASON_OPTIONS = [
  { value: '14', label: 'Season 14' },
  { value: '13', label: 'Season 13' },
  { value: '12', label: 'Season 12' },
];

const FilterPanel: React.FC<FilterPanelProps> = ({
  season,
  onSeasonChange,
  userRole,
  coachList = [],
  runnerList = [],
  selectedCoach = '',
  onCoachChange,
  selectedRunner = '',
  onRunnerChange,
  hybridToggle = 'myScore',
  onHybridToggle,
  email,
  onEmailChange,
}) => {
  return (
    <Box sx={{ width: '100%', mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="flex-start">
        <FormControl sx={{ minWidth: 140 }} size="small">
          <InputLabel id="season-label">Season</InputLabel>
          <Select
            labelId="season-label"
            value={season}
            label="Season"
            onChange={e => onSeasonChange(e.target.value)}
          >
            {SEASON_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Hybrid: Tabs for My Score and My Cohorts */}
        {userRole === 'hybrid' && onHybridToggle && (
          <></> // Tabs will be rendered in App.tsx, not here
        )}
        {/* Admin: Coach dropdown */}
        {userRole === 'admin' && coachList.length > 0 && onCoachChange && (
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel id="coach-label">Coach</InputLabel>
            <Select
              labelId="coach-label"
              value={selectedCoach}
              label="Coach"
              onChange={e => onCoachChange(e.target.value)}
            >
              {coachList.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {/* Admin, Coach: Runner dropdown */}
        {((userRole === 'admin' && runnerList.length > 0 && onRunnerChange) ||
          (userRole === 'coach' && runnerList.length > 0 && onRunnerChange)) && (
          <Box>
            <FormControl sx={{ minWidth: 180 }} size="small">
              <InputLabel id="runner-label">Runner</InputLabel>
              <Select
                labelId="runner-label"
                value={selectedRunner}
                label="Runner"
                onChange={e => onRunnerChange && onRunnerChange(e.target.value)}
              >
                {runnerList.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default FilterPanel; 