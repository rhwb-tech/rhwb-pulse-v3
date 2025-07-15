import React from 'react';
import {
  Box, FormControl, InputLabel, Select, MenuItem, Stack, ToggleButton, ToggleButtonGroup, Typography, TextField
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
      <Stack 
        direction={{ xs: 'column', md: 'row' }} 
        spacing={2} 
        sx={{ flexWrap: 'wrap', gap: 2 }}
      >
        {/* Primary filters group */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
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
          
          {/* Hybrid: Toggle between My Score and My Cohorts */}
          {userRole === 'hybrid' && onHybridToggle && (
            <ToggleButtonGroup
              value={hybridToggle}
              exclusive
              onChange={(_, val) => val && onHybridToggle(val)}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <ToggleButton value="myScore">My Score</ToggleButton>
              <ToggleButton value="myCohorts">My Cohorts</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
        
        {/* Secondary filters group */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Admin: Coach dropdown */}
          {userRole === 'admin' && coachList.length > 0 && onCoachChange && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
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
          
          {/* Admin, Coach, Hybrid (My Cohorts): Runner dropdown */}
          {((userRole === 'admin' && runnerList.length > 0 && onRunnerChange) ||
            (userRole === 'coach' && runnerList.length > 0 && onRunnerChange) ||
            (userRole === 'hybrid' && hybridToggle === 'myCohorts' && onRunnerChange)) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
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
              {userRole === 'hybrid' && hybridToggle === 'myCohorts' && runnerList.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', maxWidth: 160 }}>
                  No runners available for this coach and season.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

export default FilterPanel; 