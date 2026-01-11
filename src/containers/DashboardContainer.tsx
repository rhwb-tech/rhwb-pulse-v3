import React, { useState } from 'react';
import { Box, Fab, Drawer, Typography, IconButton } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../contexts/AuthContext';
import { useFilterState } from '../hooks/useFilterState';
import { useDashboardData } from '../hooks/useDashboardData';
import { useMenuHandlers } from '../hooks/useMenuHandlers';
import FilterChips from '../components/dashboard/FilterChips';
import DashboardWidgets from '../components/dashboard/DashboardWidgets';

const DashboardContainer: React.FC = () => {
  const { user } = useAuth();
  const email = user?.email || '';
  const userRole = user?.role || 'athlete';

  // Filter drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

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
