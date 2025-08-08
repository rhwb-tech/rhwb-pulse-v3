# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm start` - Start development server on localhost:3000
- `npm run build` - Build for production (outputs to `build/` folder)
- `npm test` - Run tests in watch mode
- `npm run eject` - Eject from Create React App (one-way operation)

## Architecture Overview

This is a React TypeScript SPA for sports performance analytics (RHWB Pulse Dashboard v2) built on Create React App with Supabase backend.

### Tech Stack
- **Frontend**: React 18.3 + TypeScript + Material-UI (MUI) 6.1.9
- **Backend**: Supabase (PostgreSQL + Auth)
- **Charts**: Recharts for bar charts, react-d3-speedometer for gauges
- **Styling**: MUI + Emotion CSS-in-JS
- **Routing**: React Router DOM 6.22

### Multi-App Architecture
Single codebase supports multiple branded applications via domain detection or environment variables:
- Configuration in `src/config/appConfig.ts`
- Apps: pulse, connect, coach, admin
- Shared authentication across all apps

## Authentication & User Roles

**Authentication**: Supabase Magic Link (passwordless email authentication)
- Handled in `src/contexts/AuthContext.tsx`
- Automatic session management with token refresh
- URL override for testing: `?email=user@example.com`

**User Roles** (determines data access):
- **athlete**: Personal data only
- **coach**: View assigned runners
- **hybrid**: Toggle between personal data and coaching cohorts  
- **admin**: Full access to all coaches and runners

**Role Determination**:
1. Primary: Database lookup in `v_pulse_roles` table
2. Fallback: Email pattern matching (@admin, @coach, @hybrid)
3. Graceful fallbacks for connection issues

## Filter Panel Behavior

The filter panel shows different controls based on user role:

**Season Filter** (All Users):
- Dropdown with Season 13 and Season 14 options
- Defaults to Season 14
- Hardcoded options in useEffect (lines 82-88 in App.tsx)

**Role-Based Filter Visibility**:
- **Athlete**: Only Season filter visible
- **Coach**: Season + Runner dropdown (for assigned runners)
- **Hybrid**: Season + My Score/My Cohorts toggle + Runner dropdown (when "My Cohorts" selected)
- **Admin**: Season + Coach chip (when selected) + Runner search box

**Admin Search Functionality**:
- Text input for searching runners by name or email
- Live search results dropdown with runner selection
- Searches `rhwb_meso_scores` table with `ilike` pattern matching
- Replaces traditional dropdown for better UX with large datasets

**Data Reloading**:
- All filter changes trigger automatic data reload via `handleApply()` or `fetchWidgetData()`
- Uses setTimeout pattern to ensure state updates before data fetching


## Database Structure

**Core Tables**:
- `rhwb_meso_scores` - Performance scores by meso cycle (main data table)
- `rhwb_coaches` - Coach information and active status
- `runners_profile` - Runner personal information
- `runner_season_info` - Season-specific runner-coach assignments
- `pulse_interactions` - User interaction tracking
- `v_pulse_roles` - User roles view (auth)
- `v_quantitative_scores` - Aggregated scores view
- `v_activity_summary` - Activity completion percentages view

**Key Patterns**:
- Row Level Security (RLS) enforces data access permissions
- Database views handle complex aggregations
- Stored procedures for complex queries (`fetch_runners_for_coach`)
- Direct Supabase client queries (no abstraction layer)
- Season-based data filtering (format: "Season 13", "Season 14")

## Component Architecture

**Main App Structure**:
- `App.tsx` - Main application with role-based filtering and dashboard layout
- `src/contexts/AuthContext.tsx` - Global authentication state
- `src/components/` - Reusable dashboard widgets

**Key Components**:
- `QuantitativeScores.tsx` - Desktop bar chart (Recharts)
- `QuantitativeScoresMobile.tsx` - Mobile optimized version
- `CumulativeScore.tsx` - Speedometer gauge component
- `ActivitySummary.tsx` - Progress circles for mileage/strength
- `TrainingFeedback.tsx` - Feedback cards with interaction tracking
- `FilterPanel.tsx` - Role-based filter controls
- `ProtectedRoute.tsx` - Authentication wrapper

**State Management**:
- Context API for authentication
- Local component state for UI state
- Direct database queries for server state (no global state management)
- useCallback for optimized re-renders

## Development Features

**Debug Mode**: Add `?debug=true` to URL for:
- SQL query visualization
- Filter state inspection  
- Database connection diagnostics

**Responsive Design**:
- Mobile breakpoint: 768px
- Different chart components for mobile vs desktop
- Touch-friendly interface elements

**Multi-Season Support**:
- Season filtering via dropdown (fetched from database)
- Default season: "13"
- RLS policies may filter available seasons per user

## Configuration

**Environment Variables** (`.env.local`):
```
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_APP_NAME=pulse # for multi-app deployment
```

**Supabase Setup**:
- Magic link authentication enabled
- Row Level Security (RLS) policies control data access
- Redirect URLs configured for auth callbacks
- Connection timeout protection (3-5 seconds)

## Common Development Patterns

**Data Fetching**:
```typescript
// Pattern for role-based queries
let query = supabase.from('v_quantitative_scores').select('...');
if (userRole === 'admin') {
  query = query.eq('season', `Season ${season}`).eq('email_id', runnerEmail);
} else if (userRole === 'athlete') {
  query = query.eq('season', `Season ${season}`).eq('email_id', email);
}
```

**Role-Based Rendering**:
```typescript
// Different UI based on user role
{userRole === 'hybrid' && (
  <Chip label={hybridToggle === 'myScore' ? 'My Score' : 'My Cohorts'} />
)}
```

**Responsive Components**:
```typescript
const isMobile = useMediaQuery('(max-width:768px)');
// Use different components for mobile vs desktop
```

## Important Notes

- No linting/formatting commands configured beyond Create React App defaults
- Minimal test coverage - focus on manual testing
- Direct Supabase queries without abstraction - be mindful of RLS policies
- Season data format must match database exactly: "Season 13", "Season 14"
- User interactions are tracked in `pulse_interactions` table
- Multi-app deployment requires domain-based configuration
- Mobile-first responsive design approach