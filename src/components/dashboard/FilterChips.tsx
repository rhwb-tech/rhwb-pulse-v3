import React from 'react';
import { Box, Chip, Stack, Menu, MenuItem, ListItemText } from '@mui/material';
import type { UserRole } from '../../types/user';

interface Option {
  value: string;
  label: string;
}

interface FilterChipsProps {
  // Values
  season: string;
  userRole: UserRole;
  selectedCoach?: string;
  selectedRunner?: string;
  hybridToggle?: 'myScore' | 'myCohorts';
  searchQuery?: string;

  // Lists
  seasonOptions: Option[];
  coachList?: Option[];
  runnerList?: Option[];
  searchResults?: Option[];

  // Menu state
  seasonMenuAnchor: HTMLElement | null;
  seasonMenuOpen: boolean;
  coachMenuAnchor: HTMLElement | null;
  coachMenuOpen: boolean;
  runnerMenuAnchor: HTMLElement | null;
  runnerMenuOpen: boolean;
  hybridToggleMenuAnchor: HTMLElement | null;
  hybridToggleMenuOpen: boolean;

  // Handlers
  onSeasonMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onSeasonMenuClose: () => void;
  onSeasonChange: (season: string) => void;

  onCoachMenuOpen?: (event: React.MouseEvent<HTMLElement>) => void;
  onCoachMenuClose?: () => void;
  onCoachChangeFromChip?: (coach: string) => void;

  onRunnerMenuOpen?: (event: React.MouseEvent<HTMLElement>) => void;
  onRunnerMenuClose?: () => void;
  onRunnerChangeFromChip?: (runner: string) => void;

  onHybridToggleMenuOpen?: (event: React.MouseEvent<HTMLElement>) => void;
  onHybridToggleMenuClose?: () => void;
  onHybridToggleChangeFromChip?: (toggle: 'myScore' | 'myCohorts') => void;

  onSearchChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRunnerSelect?: (email: string) => void;
}

const FilterChips: React.FC<FilterChipsProps> = ({
  season,
  userRole,
  selectedCoach,
  selectedRunner,
  hybridToggle,
  searchQuery,
  seasonOptions,
  coachList,
  runnerList,
  searchResults,
  seasonMenuAnchor,
  seasonMenuOpen,
  coachMenuAnchor,
  coachMenuOpen,
  runnerMenuAnchor,
  runnerMenuOpen,
  hybridToggleMenuAnchor,
  hybridToggleMenuOpen,
  onSeasonMenuOpen,
  onSeasonMenuClose,
  onSeasonChange,
  onCoachMenuOpen,
  onCoachMenuClose,
  onCoachChangeFromChip,
  onRunnerMenuOpen,
  onRunnerMenuClose,
  onRunnerChangeFromChip,
  onHybridToggleMenuOpen,
  onHybridToggleMenuClose,
  onHybridToggleChangeFromChip,
  onSearchChange,
  onRunnerSelect
}) => {
  const chipStyle = {
    bgcolor: '#e3f2fd',
    color: '#1976d2',
    fontWeight: 600,
    fontSize: { xs: 14, sm: 16, md: 18 },
    borderRadius: 999,
    px: 2,
    py: 1,
    cursor: 'pointer',
    '&:hover': { bgcolor: '#bbdefb' }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {/* Season Chip */}
        <Chip
          label={`Season ${season}`}
          onClick={onSeasonMenuOpen}
          sx={chipStyle}
        />
        <Menu
          anchorEl={seasonMenuAnchor}
          open={seasonMenuOpen}
          onClose={onSeasonMenuClose}
        >
          {seasonOptions.map((opt) => (
            <MenuItem key={opt.value} onClick={() => onSeasonChange(opt.value)}>
              <ListItemText primary={opt.label} />
            </MenuItem>
          ))}
        </Menu>

        {/* Hybrid Toggle Chip */}
        {userRole === 'hybrid' && (
          <>
            <Chip
              label={hybridToggle === 'myScore' ? 'My Score' : 'My Cohorts'}
              onClick={onHybridToggleMenuOpen}
              sx={chipStyle}
            />
            <Menu
              anchorEl={hybridToggleMenuAnchor}
              open={hybridToggleMenuOpen}
              onClose={onHybridToggleMenuClose}
            >
              <MenuItem onClick={() => onHybridToggleChangeFromChip?.('myScore')}>
                My Score
              </MenuItem>
              <MenuItem onClick={() => onHybridToggleChangeFromChip?.('myCohorts')}>
                My Cohorts
              </MenuItem>
            </Menu>
          </>
        )}

        {/* Coach Chip (Admin only) */}
        {userRole === 'admin' && coachList && coachList.length > 0 && (
          <>
            <Chip
              label={selectedCoach || 'Select Coach'}
              onClick={onCoachMenuOpen}
              sx={chipStyle}
            />
            <Menu anchorEl={coachMenuAnchor} open={coachMenuOpen} onClose={onCoachMenuClose}>
              {coachList.map((coach) => (
                <MenuItem key={coach.value} onClick={() => onCoachChangeFromChip?.(coach.value)}>
                  {coach.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {/* Runner Chip */}
        {(userRole === 'coach' || userRole === 'admin' || (userRole === 'hybrid' && hybridToggle === 'myCohorts')) && selectedRunner && (
          <>
            <Chip
              label={runnerList?.find(r => r.value === selectedRunner)?.label || selectedRunner}
              onClick={onRunnerMenuOpen}
              sx={chipStyle}
            />
            <Menu anchorEl={runnerMenuAnchor} open={runnerMenuOpen} onClose={onRunnerMenuClose}>
              {runnerList?.map((runner) => (
                <MenuItem key={runner.value} onClick={() => onRunnerChangeFromChip?.(runner.value)}>
                  {runner.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default FilterChips;
