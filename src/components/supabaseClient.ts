import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || supabaseUrl.includes('<YOUR_SUPABASE_URL>')) {
  throw new Error(
    'REACT_APP_SUPABASE_URL is not configured. Please check your .env.local file.'
  );
}

if (!supabaseAnonKey || supabaseAnonKey.includes('<YOUR_SUPABASE_ANON_KEY>')) {
  throw new Error(
    'REACT_APP_SUPABASE_ANON_KEY is not configured. Please check your .env.local file.'
  );
}

// Helper to check if public laptop mode is enabled
const isPublicLaptopMode = (): boolean => {
  try {
    return sessionStorage.getItem('rhwb-pulse-public-laptop') === 'true';
  } catch {
    return false;
  }
};

// Helper to get the appropriate storage (sessionStorage for public laptop, localStorage otherwise)
const getStorage = () => {
  return isPublicLaptopMode() ? sessionStorage : localStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'rhwb-pulse-auth', // App-specific storage key
    storage: {
      getItem: (key) => {
        try {
          const storage = getStorage();
          return storage.getItem(`rhwb-pulse-${key}`);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          const storage = getStorage();
          storage.setItem(`rhwb-pulse-${key}`, value);
        } catch {
          // Handle storage errors
        }
      },
      removeItem: (key) => {
        try {
          const storage = getStorage();
          storage.removeItem(`rhwb-pulse-${key}`);
        } catch {
          // Handle storage errors
        }
      }
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'rhwb-pulse-v3'
    }
  },
  db: {
    schema: 'public'
  }
});

// Separate client for validation queries (no session persistence to avoid hanging)
export const supabaseValidation = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'rhwb-pulse-v3-validation'
    }
  },
  db: {
    schema: 'public'
  }
});

// Helper to ensure Supabase is fully initialized before making queries
let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

export const ensureSupabaseInitialized = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log('[SUPABASE] Adding small delay for client initialization...');

    // Just add a small delay to let any pending initialization complete
    // Don't call getSession() as that itself can hang
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[SUPABASE] Proceeding with queries');
    isInitialized = true;
  })();

  return initializationPromise;
};

// Query timeout helper - wraps any Supabase query with timeout protection
export async function queryWithTimeout<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 10000,
  errorMessage: string = 'Query timeout'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error: any) {
    console.error(`[SUPABASE] ${errorMessage}:`, error);
    throw error;
  }
} 