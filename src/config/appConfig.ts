// App-specific configuration
export interface AppConfig {
  appName: string;
  appDomain: string;
  dashboardTitle: string;
  emailSubject: string;
  supportEmail: string;
  supportSubject: string;
}

// Configuration for different apps
const APP_CONFIGS: Record<string, AppConfig> = {
  'pulse': {
    appName: 'RHWB Pulse',
    appDomain: 'rhwb-pulse.vercel.app',
    dashboardTitle: 'Athlete Performance',
    emailSubject: 'Sign in to RHWB Pulse',
    supportEmail: 'techteamrhwb@gmail.com',
    supportSubject: 'Unable to login to Pulse'
  },
  'coach': {
    appName: 'RHWB Coach Portal',
    appDomain: 'rhwb-coach.vercel.app',
    dashboardTitle: 'Coach Management',
    emailSubject: 'Sign in to RHWB Coach Portal',
    supportEmail: 'techteamrhwb@gmail.com',
    supportSubject: 'Unable to login to Coach Portal'
  },
  'admin': {
    appName: 'RHWB Admin Portal',
    appDomain: 'rhwb-admin.vercel.app',
    dashboardTitle: 'Administrative',
    emailSubject: 'Sign in to RHWB Admin Portal',
    supportEmail: 'techteamrhwb@gmail.com',
    supportSubject: 'Unable to login to Admin Portal'
  }
};

// Detect current app based on domain or environment variable
const getCurrentApp = (): string => {
  // Check environment variable first
  const envApp = process.env.REACT_APP_APP_NAME;
  if (envApp && APP_CONFIGS[envApp]) {
    return envApp;
  }
  
  // Detect from domain
  const hostname = window.location.hostname;
  if (hostname.includes('pulse')) return 'pulse';
  if (hostname.includes('coach')) return 'coach';
  if (hostname.includes('admin')) return 'admin';
  
  // Default to pulse
  return 'pulse';
};

export const getAppConfig = (): AppConfig => {
  const currentApp = getCurrentApp();
  return APP_CONFIGS[currentApp] || APP_CONFIGS['pulse'];
};

export default getAppConfig; 