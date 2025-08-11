import React from 'react';
import { Box, Typography, IconButton, Tooltip as MuiTooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, ReferenceLine,
} from 'recharts';

// Types for the data
export interface ActiveMinutesData {
  meso: string;
  workout_date: string;
  activity: string;
  completed_time_in_mins: number;
}

interface ActiveMinutesProps {
  data: ActiveMinutesData[];
}

const COLORS = {
  'Run': "#4285F4", // Google Blue
  'Running': "#4285F4", // Google Blue
  'Cross-Training': "#EA4335", // Google Red
  'Cross Training': "#EA4335", // Google Red
  'Swim': "#34A853", // Google Green
  'Swimming': "#34A853", // Google Green
  'Walk': "#FBBC04", // Google Yellow
  'Walking': "#FBBC04", // Google Yellow
  'Strength': "#9C27B0", // Purple
  'Strength Training': "#9C27B0", // Purple
  'Recovery': "#FF9800", // Orange
  'Other': "#607D8B", // Blue Grey
};

const ActiveMinutes: React.FC<ActiveMinutesProps> = ({ data }) => {
  // SSR-safe isMobile
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

  // Process data to group by meso and workout_date
  const processedData = React.useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const key = `${item.meso}_${item.workout_date}`;
      if (!acc[key]) {
        acc[key] = {
          meso: item.meso,
          workout_date: item.workout_date,
          displayName: `${item.meso} - ${new Date(item.workout_date).toLocaleDateString()}`,
          total: 0,
          activities: {} as Record<string, number>
        };
      }
      acc[key].total += item.completed_time_in_mins;
      acc[key].activities[item.activity] = (acc[key].activities[item.activity] || 0) + item.completed_time_in_mins;
      return acc;
    }, {} as Record<string, any>);

    // Sort by meso and workout_date
    return Object.values(grouped)
      .map((item: any) => ({
        meso: item.meso,
        workout_date: item.workout_date,
        displayName: item.displayName,
        total: item.total,
        ...item.activities
      }))
      .sort((a: any, b: any) => {
        if (a.meso !== b.meso) {
          return a.meso.localeCompare(b.meso);
        }
        return new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime();
      });
  }, [data]);

  // Get unique activities for legend
  const activities = React.useMemo(() => {
    const activitySet = new Set<string>();
    data.forEach(item => activitySet.add(item.activity));
    return Array.from(activitySet);
  }, [data]);

  return (
          <Box sx={{ 
        width: '100%', 
        height: isMobile ? 350 : 400, 
        bgcolor: 'background.paper', 
        borderRadius: 2, 
        p: isMobile ? 1 : 2, 
        boxShadow: 1 
      }}>
      <Typography 
        variant="h6" 
        gutterBottom 
        sx={{ 
          fontSize: isMobile ? '1.1rem' : '1.25rem',
          fontWeight: 600,
          mb: isMobile ? 0.5 : 2
        }}
      >
        Daily Active Minutes by Activity Type vs Target
      </Typography>
              <ResponsiveContainer width="100%" height={isMobile ? 270 : 320}>
        <BarChart 
          data={processedData} 
          margin={{ 
            top: isMobile ? 20 : 25, 
            right: isMobile ? 12 : 40, 
            left: isMobile ? 20 : 35, 
            bottom: isMobile ? 5 : 8 
          }}
          layout="horizontal"
          barCategoryGap={isMobile ? "25%" : "30%"}
          barGap={isMobile ? 2 : 4}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={[0, 175]}
            ticks={[0, 25, 50, 75, 100, 125, 150, 175]}
            allowDataOverflow={false}
            scale="linear"
            label={{ value: 'Minutes', position: 'insideBottom', offset: -5 }}
          />
          <YAxis dataKey="displayName" type="category" width={isMobile ? 20 : 30} />
          <Tooltip />
          <Legend 
            verticalAlign="bottom" 
            height={isMobile ? 90 : 100}
            content={({ payload }) => (
              <div style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: isMobile ? '6px' : '8px',
                marginTop: isMobile ? '10px' : '15px',
                marginLeft: isMobile ? '10px' : '15px'
              }}>
                {activities.map((activity, index) => (
                  <div key={activity} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                    <div style={{ 
                      width: isMobile ? '10px' : '12px', 
                      height: isMobile ? '10px' : '12px', 
                      backgroundColor: COLORS[activity as keyof typeof COLORS] || '#9C27B0', 
                      borderRadius: '2px' 
                    }}></div>
                    <span style={{ fontSize: isMobile ? '12px' : '14px' }}>{activity.toUpperCase()}</span>
                    <MuiTooltip title={`Total ${activity} minutes`}>
                      <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </MuiTooltip>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', marginTop: '8px' }}>
                  <div style={{ 
                    width: isMobile ? '10px' : '12px', 
                    height: isMobile ? '10px' : '12px', 
                    backgroundColor: '#FF6B6B', 
                    borderRadius: '2px',
                    border: '2px dashed #FF6B6B'
                  }}></div>
                  <span style={{ fontSize: isMobile ? '12px' : '14px' }}>WHO/CDC Target: 150 min</span>
                  <MuiTooltip title="Recommended weekly active minutes target">
                    <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </MuiTooltip>
                </div>
              </div>
            )}
          />
                     {activities.map((activity) => (
             <Bar 
               key={activity}
               dataKey={activity} 
               name={activity} 
               fill={COLORS[activity as keyof typeof COLORS] || '#9C27B0'} 
               radius={[0, 4, 4, 0]} 
               barSize={isMobile ? 15 : 20}
               stackId="a"
             />
           ))}
           <Bar 
             dataKey="total" 
             fill="transparent" 
             barSize={0}
           >
             <LabelList dataKey="total" position="right" fontSize={isMobile ? 8 : 10} />
           </Bar>
          <ReferenceLine 
            x={150} 
            stroke="#FF6B6B" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            label={{ value: 'WHO/CDC Target: 150 min', position: 'top', fill: '#FF6B6B', fontSize: isMobile ? 10 : 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default ActiveMinutes;
