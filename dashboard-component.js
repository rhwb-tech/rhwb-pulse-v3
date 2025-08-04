import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

// Types for the data
export interface QualitativeScoreData {
  meso: string;
  personal: number;
  coach: number;
  raceDistance: number;
}

interface DashboardProps {
  qualitativeData?: QualitativeScoreData[];
  strengthPlanned?: number;
  strengthCompleted?: number;
  mileagePlanned?: number;
  mileageCompleted?: number;
}

const COLORS = {
  coach: "#4285F4", // Google Blue
  personal: "#EA4335", // Google Red
  raceDistance: "#34A853", // Google Green
};

const Dashboard: React.FC<DashboardProps> = ({
  qualitativeData = [
    {
      meso: "Meso 1",
      personal: 1.5,
      coach: 1.5,
      raceDistance: 3.3
    },
    {
      meso: "Meso 2", 
      personal: 0.6,
      coach: 0.5,
      raceDistance: 2.7
    },
    {
      meso: "Meso 3",
      personal: 4.8,
      coach: 0.7,
      raceDistance: 2.7
    },
    {
      meso: "Meso 4",
      personal: 5.0,
      coach: 0.5,
      raceDistance: 2.4
    }
  ],
  strengthPlanned = 6,
  strengthCompleted = 0,
  mileagePlanned = 32,
  mileageCompleted = 0
}) => {
  const isMobile = window.innerWidth <= 768;

  // Calculate percentages
  const strengthPercentage = strengthPlanned > 0 ? (strengthCompleted / strengthPlanned) * 100 : 0;
  const mileagePercentage = mileagePlanned > 0 ? (mileageCompleted / mileagePlanned) * 100 : 0;

  // Progress circle component
  const ProgressCircle = ({ percentage, color, size = 120 }) => {
    const radius = (size - 12) / 2; // Account for stroke width
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f0f0f0"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out'
            }}
          />
        </svg>
        {/* Percentage text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          {Math.round(percentage)}%
        </div>
      </div>
    );
  };

  // Info card component
  const InfoCard = ({ title, value, color, bgColor }) => (
    <div style={{
      backgroundColor: bgColor,
      borderRadius: '12px',
      padding: isMobile ? '16px' : '20px',
      flex: '1',
      minWidth: '0'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}>
        <span style={{
          color: color,
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: '600'
        }}>
          {title}
        </span>
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: '#ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: 'white',
          cursor: 'help'
        }}>
          i
        </div>
      </div>
      <div style={{
        fontSize: isMobile ? '2rem' : '2.5rem',
        fontWeight: 'bold',
        color: color,
        lineHeight: '1'
      }}>
        {value}
      </div>
    </div>
  );

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '16px' : '24px'
    }}>
      {/* Quantitative Scores Chart - Top */}
      <div style={{ 
        width: '100%', 
        height: isMobile ? '350px' : '400px', 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        padding: isMobile ? '12px' : '16px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          marginBottom: isMobile ? '8px' : '16px', 
          fontSize: isMobile ? '1.1rem' : '1.25rem', 
          fontWeight: '600' 
        }}>
          Quantitative Score
        </h2>
        
        <ResponsiveContainer width="100%" height={isMobile ? 270 : 320}>
          <BarChart 
            data={qualitativeData} 
            margin={{ 
              top: isMobile ? 20 : 25, 
              right: isMobile ? 12 : 24, 
              left: isMobile ? 35 : 50, 
              bottom: isMobile ? 5 : 8 
            }}
            layout="vertical"
            barCategoryGap={isMobile ? "25%" : "30%"}
            barGap={isMobile ? 2 : 4}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              domain={[0, 5]} 
              ticks={[0, 1, 2, 3, 4, 5]}
              allowDataOverflow={false}
              scale="linear"
            />
            <YAxis dataKey="meso" type="category" width={isMobile ? 30 : 40} />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                    <div style={{ 
                      width: isMobile ? '10px' : '12px', 
                      height: isMobile ? '10px' : '12px', 
                      backgroundColor: COLORS.personal, 
                      borderRadius: '2px' 
                    }}></div>
                    <span style={{ fontSize: isMobile ? '12px' : '14px' }}>Personal</span>
                    <span style={{ 
                      backgroundColor: '#666', 
                      color: 'white', 
                      borderRadius: '50%', 
                      width: isMobile ? '14px' : '16px', 
                      height: isMobile ? '14px' : '16px', 
                      fontSize: isMobile ? '10px' : '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginLeft: '2px',
                      cursor: 'help'
                    }} title="Your Personal qualitative score this Meso cycle">i</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                    <div style={{ 
                      width: isMobile ? '10px' : '12px', 
                      height: isMobile ? '10px' : '12px', 
                      backgroundColor: COLORS.raceDistance, 
                      borderRadius: '2px' 
                    }}></div>
                    <span style={{ fontSize: isMobile ? '12px' : '14px' }}>Race Distance</span>
                    <span style={{ 
                      backgroundColor: '#666', 
                      color: 'white', 
                      borderRadius: '50%', 
                      width: isMobile ? '14px' : '16px', 
                      height: isMobile ? '14px' : '16px', 
                      fontSize: isMobile ? '10px' : '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginLeft: '2px',
                      cursor: 'help'
                    }} title="The average qualitative score of all runners registered for the same race distance">i</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' }}>
                    <div style={{ 
                      width: isMobile ? '10px' : '12px', 
                      height: isMobile ? '10px' : '12px', 
                      backgroundColor: COLORS.coach, 
                      borderRadius: '2px' 
                    }}></div>
                    <span style={{ fontSize: isMobile ? '12px' : '14px' }}>Coach</span>
                    <span style={{ 
                      backgroundColor: '#666', 
                      color: 'white', 
                      borderRadius: '50%', 
                      width: isMobile ? '14px' : '16px', 
                      height: isMobile ? '14px' : '16px', 
                      fontSize: isMobile ? '10px' : '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginLeft: '2px',
                      cursor: 'help'
                    }} title="The average qualitative score of all runners under your coach">i</span>
                  </div>
                </div>
              )}
            />
            <Bar dataKey="personal" name="Personal" fill={COLORS.personal} radius={[0, 4, 4, 0]} barSize={isMobile ? 15 : 20}>
              <LabelList dataKey="personal" position="right" fontSize={isMobile ? 10 : 12} />
            </Bar>
            <Bar dataKey="raceDistance" name="Race Distance" fill={COLORS.raceDistance} radius={[0, 4, 4, 0]} barSize={isMobile ? 15 : 20}>
              <LabelList dataKey="raceDistance" position="right" fontSize={isMobile ? 10 : 12} />
            </Bar>
            <Bar dataKey="coach" name="Coach" fill={COLORS.coach} radius={[0, 4, 4, 0]} barSize={isMobile ? 15 : 20}>
              <LabelList dataKey="coach" position="right" fontSize={isMobile ? 10 : 12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Activity Summary - Bottom */}
      <div style={{
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          marginBottom: isMobile ? '16px' : '20px', 
          fontSize: isMobile ? '1.1rem' : '1.25rem', 
          fontWeight: '600' 
        }}>
          Activity Summary
        </h2>

        {/* Progress Circles */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          marginBottom: isMobile ? '24px' : '32px',
          gap: '20px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <ProgressCircle 
              percentage={strengthPercentage} 
              color="#4285F4" 
              size={isMobile ? 100 : 120}
            />
            <div style={{
              textAlign: 'center',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              color: '#4285F4'
            }}>
              Strength % Completed
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <ProgressCircle 
              percentage={mileagePercentage} 
              color="#9C27B0" 
              size={isMobile ? 100 : 120}
            />
            <div style={{
              textAlign: 'center',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              color: '#9C27B0'
            }}>
              Mileage % Completed
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '12px' : '16px',
          marginBottom: isMobile ? '16px' : '20px'
        }}>
          <InfoCard
            title="Strength Planned"
            value={strengthPlanned}
            color="#4285F4"
            bgColor="#f8f9ff"
          />
          <InfoCard
            title="Strength Completed"
            value={strengthCompleted}
            color="#34A853"
            bgColor="#f8fff9"
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '12px' : '16px'
        }}>
          <InfoCard
            title="Mileage Planned"
            value={mileagePlanned}
            color="#9C27B0"
            bgColor="#fdf8ff"
          />
          <InfoCard
            title="Mileage Completed"
            value={mileageCompleted}
            color="#4285F4"
            bgColor="#f8f9ff"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;