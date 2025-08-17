import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '<YOUR_SUPABASE_URL>';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '<YOUR_SUPABASE_ANON_KEY>';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'rhwb-pulse-auth', // App-specific storage key
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(`rhwb-pulse-${key}`);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(`rhwb-pulse-${key}`, value);
        } catch {
          // Handle storage errors
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(`rhwb-pulse-${key}`);
        } catch {
          // Handle storage errors
        }
      }
    }
  }
}); 