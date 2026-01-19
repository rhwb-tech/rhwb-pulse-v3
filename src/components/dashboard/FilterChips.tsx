import React from 'react';
import { Box, Chip, Stack, Menu, MenuItem, ListItemText, ToggleButtonGroup, ToggleButton } from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import SportsIcon from '@mui/icons-material/Sports';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import type { UserRole } from '../../types/user';

interface Option {
  value: string;
  label: string;
}

interface FilterChipsProps {
  // Values
  season: string;
  userRole: UserRole | undefined;
  selectedCoach?: string;
  selectedRunner?: string;
  hybridToggle?: 'myScore' | 'myCohorts';
  searchQuery?: string;
  
  // Override mode
  isOverrideActive?: boolean;
  overrideEmail?: string | null;

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
  isOverrideActive = false,
  overrideEmail,
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

        {/* Hybrid Role Toggle - Modern ToggleButtonGroup */}
        {userRole === 'hybrid' && (
          <ToggleButtonGroup
            value={hybridToggle === 'myScore' ? 'runner' : 'coach'}
            exclusive
            onChange={(e, newValue) => {
              if (newValue) {
                onHybridToggleChangeFromChip?.(newValue === 'runner' ? 'myScore' : 'myCohorts');
              }
            }}
            sx={{
              bgcolor: 'background.paper',
              height: { xs: 36, sm: 40, md: 44 },
              '& .MuiToggleButton-root': {
                px: { xs: 2, sm: 2.5, md: 3 },
                py: { xs: 0.5, sm: 1 },
                fontSize: { xs: 14, sm: 16, md: 18 },
                fontWeight: 600,
                border: '2px solid #1976d2',
                color: '#1976d2',
                textTransform: 'none',
                '&.Mui-selected': {
                  bgcolor: '#1976d2',
                  color: 'white',
                  '&:hover': {
                    bgcolor: '#1565c0',
                  },
                },
                '&:hover': {
                  bgcolor: '#e3f2fd',
                },
              },
            }}
          >
            <ToggleButton value="runner">
              <DirectionsRunIcon sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: { xs: 18, sm: 20, md: 22 } }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Runner</Box>
            </ToggleButton>
            <ToggleButton value="coach">
              <SportsIcon sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: { xs: 18, sm: 20, md: 22 } }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Coach</Box>
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        {/* Override Email Chip - shown when admin is viewing another user's data */}
        {isOverrideActive && overrideEmail && (
          <Chip
            icon={<PersonSearchIcon sx={{ fontSize: { xs: 18, sm: 20, md: 22 } }} />}
            label={overrideEmail}
            sx={{
              bgcolor: '#fff3e0',
              color: '#e65100',
              fontWeight: 600,
              fontSize: { xs: 14, sm: 16, md: 18 },
              borderRadius: 999,
              px: 2,
              py: 1,
              border: '2px solid #ffb74d',
            }}
          />
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

        {/* Runner Chip - for Coach, Hybrid, or Admin (when coach is selected) */}
        {((userRole === 'coach') ||
          (userRole === 'hybrid' && hybridToggle === 'myCohorts') ||
          (userRole === 'admin' && selectedCoach)) &&
         runnerList && runnerList.length > 0 && (
          <>
            <Chip
              label={selectedRunner ? (runnerList?.find(r => r.value === selectedRunner)?.label || selectedRunner) : 'Select Runner'}
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
