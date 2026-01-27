import React, { useState, useEffect, useRef } from 'react';
import { Box, Fab, Drawer, Typography, IconButton, Chip } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import UpdateIcon from '@mui/icons-material/Update';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useFilterState } from '../hooks/useFilterState';
import { useDashboardData } from '../hooks/useDashboardData';
import { useMenuHandlers } from '../hooks/useMenuHandlers';
import FilterChips from '../components/dashboard/FilterChips';
import DashboardWidgets from '../components/dashboard/DashboardWidgets';

const FILTER_PANEL_STORAGE_KEY = 'rhwb_pulse_filter_panel_open';

const DashboardContainer: React.FC = () => {
  const { user } = useAuth();
  const { effectiveEmail, isOverrideActive, overrideEmail } = useApp();
  
  // Use effectiveEmail (which respects override) for dashboard data
  const email = effectiveEmail || user?.email || '';

  // Don't default to 'runner' when user is loading - this prevents clearing coachList on refresh
  // Wait for user to load before determining role
  // Keep the actual user role even in override mode so admin filters remain visible
  const userRole = user?.role;

  // Debug logging for admin users
  React.useEffect(() => {
    if (user) {
      console.log('[DASHBOARD CONTAINER] User:', { email: user.email, role: user.role });
      console.log('[DASHBOARD CONTAINER] userRole will be:', userRole);
      console.log('[DASHBOARD CONTAINER] effectiveEmail:', effectiveEmail);
      console.log('[DASHBOARD CONTAINER] isOverrideActive:', isOverrideActive);
      if (isOverrideActive) {
        console.log('[DASHBOARD CONTAINER] Override mode - viewing as:', overrideEmail);
      }
    } else {
      console.log('[DASHBOARD CONTAINER] User is null - userRole will be undefined');
    }
  }, [user, effectiveEmail, isOverrideActive, overrideEmail, userRole]);

  // Filter drawer state - always open on initial load, but persist manual closes
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(true);

  // Persist filter panel state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_PANEL_STORAGE_KEY, String(filterDrawerOpen));
    } catch (error) {
      console.warn('[DASHBOARD CONTAINER] Failed to save filter panel state:', error);
    }
  }, [filterDrawerOpen]);

  // Filter state
  const filterState = useFilterState(userRole);

  // Dashboard data
  const dashboardData = useDashboardData(
    email,
    userRole,
    filterState.season,
    filterState.selectedRunner,
    filterState.selectedCoach,
    filterState.hybridToggle,
    filterState.coachName,
    filterState.setCoachList,
    filterState.setRunnerList,
    filterState.setCoachName
  );

  // Menu handlers
  const menuHandlers = useMenuHandlers(
    filterState.setSeason,
    filterState.setSelectedCoach,
    filterState.setSelectedRunner,
    filterState.setHybridToggle,
    filterState.setSeasonMenuAnchor,
    filterState.setCoachMenuAnchor,
    filterState.setRunnerMenuAnchor,
    filterState.setHybridToggleMenuAnchor,
    filterState.setSearchQuery,
    filterState.setSearchResults,
    filterState.runnerList,
    dashboardData.searchRunners,
    email
  );

  // Ref for charts container to focus/scroll to when filter panel closes
  const chartsContainerRef = useRef<HTMLDivElement>(null);

  // Track previous selections to detect changes
  const prevRunnerRef = useRef<string>('');
  const prevSeasonRef = useRef<string>('');
  const isInitialMountRef = useRef(true);

  // Close filter panel when season is selected (for runner role only)
  useEffect(() => {
    // Initialize refs on first run
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevSeasonRef.current = filterState.season;
      prevRunnerRef.current = filterState.selectedRunner;
      return;
    }

    // For runner role: close panel when season changes
    if (userRole === 'runner') {
      const currentSeason = filterState.season;
      const prevSeason = prevSeasonRef.current;

      // If season changed to a non-empty value and panel is open, close it and focus charts
      if (currentSeason && currentSeason !== prevSeason && filterDrawerOpen) {
        setFilterDrawerOpen(false);
        
        // Move focus to charts after a brief delay to allow panel to close
        setTimeout(() => {
          if (chartsContainerRef.current) {
            chartsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Also focus the container for keyboard navigation
            chartsContainerRef.current.focus();
          }
        }, 100);
      }

      prevSeasonRef.current = currentSeason;
    }
  }, [filterState.season, filterState.selectedRunner, filterDrawerOpen, userRole]);

  // Close filter panel when a runner is selected (for non-runner roles)
  useEffect(() => {
    // Skip on initial mount (refs will be initialized by the season effect)
    if (isInitialMountRef.current) {
      return;
    }

    // For non-runner roles: close panel when runner is selected
    if (userRole !== 'runner' && userRole !== undefined) {
      const currentRunner = filterState.selectedRunner;
      const prevRunner = prevRunnerRef.current;

      // If runner changed to a non-empty value and panel is open, close it
      if (currentRunner && currentRunner !== prevRunner && filterDrawerOpen) {
        setFilterDrawerOpen(false);
      }

      prevRunnerRef.current = currentRunner; // Update previous runner for next comparison
    }
  }, [filterState.selectedRunner, filterDrawerOpen, userRole]);

  // Format the last data refresh date
  const formatRefreshDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      // Parse date parts directly to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Get the selected runner's name from the runner list
  const getRunnerName = () => {
    if (!filterState.selectedRunner) return null;
    const runner = filterState.runnerList.find(r => r.value === filterState.selectedRunner);
    return runner?.label || filterState.selectedRunner;
  };

  // Get the selected coach's name
  const getCoachName = () => {
    if (userRole === 'admin' && filterState.selectedCoach) {
      return filterState.selectedCoach;
    }
    if ((userRole === 'coach' || userRole === 'hybrid') && filterState.coachName) {
      return filterState.coachName;
    }
    return null;
  };

  return (
    <>
      <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 1 }}>
        {/* Info Bar - Current Selections & Data Refresh */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 2,
            p: 1.5,
            bgcolor: 'rgba(24, 119, 242, 0.04)',
            borderRadius: 2,
            border: '1px solid rgba(24, 119, 242, 0.1)',
          }}
        >
          {/* Current Selections */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`Season ${filterState.season}`}
              size="small"
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
              onClick={() => setFilterDrawerOpen(true)}
            />

            {/* Show coach for admin/coach/hybrid roles */}
            {getCoachName() && (
              <Chip
                label={`Coach: ${getCoachName()}`}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
                onClick={() => setFilterDrawerOpen(true)}
              />
            )}

            {/* Show hybrid toggle state */}
            {userRole === 'hybrid' && (
              <Chip
                label={filterState.hybridToggle === 'myScore' ? 'My Score' : 'My Cohorts'}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: '#9c27b0',
                  color: '#9c27b0',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
                onClick={() => setFilterDrawerOpen(true)}
              />
            )}

            {/* Show selected runner */}
            {getRunnerName() && (
              <Chip
                label={getRunnerName()}
                size="small"
                sx={{
                  bgcolor: '#e3f2fd',
                  color: '#1565c0',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
                onClick={() => setFilterDrawerOpen(true)}
              />
            )}
          </Box>

          {/* Data Refresh Date */}
          {dashboardData.lastDataRefresh && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'text.secondary',
                fontSize: '0.75rem',
              }}
            >
              <UpdateIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                Data as of {formatRefreshDate(dashboardData.lastDataRefresh)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Dashboard Widgets */}
        <Box ref={chartsContainerRef} tabIndex={-1} sx={{ outline: 'none' }}>
          <DashboardWidgets
            loading={dashboardData.loading}
            error={dashboardData.error}
            data={dashboardData.data}
            cumulativeScore={dashboardData.cumulativeScore}
            activitySummary={dashboardData.activitySummary}
            trainingFeedback={dashboardData.trainingFeedback}
            userEmail={email}
          />
        </Box>
      </Box>

      {/* Filter FAB Button */}
      <Fab
        color="primary"
        aria-label="filters"
        onClick={() => setFilterDrawerOpen(true)}
        sx={{
          position: 'fixed',
          // Use safe-area insets so the FAB stays tappable across all iPhones
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 24px)',
          background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0E5FD3 0%, #0A4EB0 100%)',
          },
          // Ensure the FAB sits above drawers/modals so taps aren’t blocked
          zIndex: (theme) => theme.zIndex.modal + 1,
        }}
      >
        <FilterListIcon />
      </Fab>

      {/* Filter Bottom Sheet Drawer */}
      <Drawer
        anchor="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80vh',
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
          color: 'white'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Filters
            </Typography>
            <IconButton
              onClick={() => setFilterDrawerOpen(false)}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Filter Content */}
        <Box sx={{ p: 2 }}>
          <FilterChips
            season={filterState.season}
            userRole={userRole}
            selectedCoach={filterState.selectedCoach}
            selectedRunner={filterState.selectedRunner}
            hybridToggle={filterState.hybridToggle}
            searchQuery={filterState.searchQuery}
            isOverrideActive={isOverrideActive}
            overrideEmail={overrideEmail}
            seasonOptions={filterState.seasonOptions}
            coachList={filterState.coachList}
            runnerList={filterState.runnerList}
            searchResults={filterState.searchResults}
            seasonMenuAnchor={filterState.seasonMenuAnchor}
            seasonMenuOpen={filterState.seasonMenuOpen}
            coachMenuAnchor={filterState.coachMenuAnchor}
            coachMenuOpen={filterState.coachMenuOpen}
            runnerMenuAnchor={filterState.runnerMenuAnchor}
            runnerMenuOpen={filterState.runnerMenuOpen}
            hybridToggleMenuAnchor={filterState.hybridToggleMenuAnchor}
            hybridToggleMenuOpen={filterState.hybridToggleMenuOpen}
            onSeasonMenuOpen={menuHandlers.handleSeasonMenuOpen}
            onSeasonMenuClose={menuHandlers.handleSeasonMenuClose}
            onSeasonChange={menuHandlers.handleSeasonChange}
            onCoachMenuOpen={menuHandlers.handleCoachMenuOpen}
            onCoachMenuClose={menuHandlers.handleCoachMenuClose}
            onCoachChangeFromChip={menuHandlers.handleCoachChangeFromChip}
            onRunnerMenuOpen={menuHandlers.handleRunnerMenuOpen}
            onRunnerMenuClose={menuHandlers.handleRunnerMenuClose}
            onRunnerChangeFromChip={menuHandlers.handleRunnerChangeFromChip}
            onHybridToggleMenuOpen={menuHandlers.handleHybridToggleMenuOpen}
            onHybridToggleMenuClose={menuHandlers.handleHybridToggleMenuClose}
            onHybridToggleChangeFromChip={menuHandlers.handleHybridToggleChangeFromChip}
            onSearchChange={menuHandlers.handleSearchChange}
            onRunnerSelect={menuHandlers.handleRunnerSelect}
          />
        </Box>
      </Drawer>
    </>
  );
};

export default DashboardContainer;
