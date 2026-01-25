import React, { useState, useEffect, useRef } from 'react';
import { Box, Fab, Drawer, Typography, IconButton } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
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

  // Track previous runner selection to detect changes
  const prevRunnerRef = useRef<string>('');
  const isInitialMountRef = useRef(true);

  // Close filter panel when a runner is selected (but not on initial mount)
  useEffect(() => {
    // Skip on initial mount to avoid closing panel if runner was already selected
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevRunnerRef.current = filterState.selectedRunner;
      return;
    }

    const currentRunner = filterState.selectedRunner;
    const prevRunner = prevRunnerRef.current;

    // If runner changed to a non-empty value and panel is open, close it
    if (currentRunner && currentRunner !== prevRunner && filterDrawerOpen) {
      setFilterDrawerOpen(false);
    }

    prevRunnerRef.current = currentRunner;
  }, [filterState.selectedRunner, filterDrawerOpen]);

  return (
    <>
      <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 1 }}>
        {/* Dashboard Widgets */}
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

      {/* Filter FAB Button */}
      <Fab
        color="primary"
        aria-label="filters"
        onClick={() => setFilterDrawerOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 90,
          right: 24,
          background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0E5FD3 0%, #0A4EB0 100%)',
          },
          zIndex: 999
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
