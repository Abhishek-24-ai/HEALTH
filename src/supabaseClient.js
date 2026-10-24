import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Initializer for Aura-Triage Cloud Replication
 * Reads securely from Vite environment variables with production fallbacks.
 * Provides zero-crash graceful fallback when credentials are not configured.
 */

export const DEFAULT_SUPABASE_URL = 'https://zmvddzdzymyzorutstix.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptdmRkemR6eW15em9ydXRzdGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MTU2OTYsImV4cCI6MjEwODM5MTY5Nn0.6ZKarCnp60h_XjXU2NBOHbGY36-j91HljnUn2VZ-Xg8';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
export const supabaseAnonKey = typeof rawKey === 'string' ? rawKey.trim() : '';

// Validates whether actual, non-placeholder credentials have been provided
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-public-key')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[AURA-TRIAGE] Supabase cloud connection inactive. ' +
    'The system is operating in 100% resilient Offline Air-Gap Mode using Dexie IndexedDB.'
  );
}

// Fallback dummy credentials to allow safe createClient initialization without crashing
const safeUrl = isSupabaseConfigured ? supabaseUrl : 'https://aura-offline.supabase.co';
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * SQL Schema definition for the Supabase 'patients' table.
 * Displayed in the Dashboard settings drawer to guide field administrators.
 */
export const SUPABASE_PATIENTS_TABLE_SQL = `
-- Create patients triage table for Aura-Triage
CREATE TABLE IF NOT EXISTS public.patients (
  id BIGSERIAL PRIMARY KEY,
  patient_uuid TEXT UNIQUE NOT NULL,
  triage_id TEXT,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  chief_complaint TEXT,
  allergies TEXT,
  medical_history TEXT,
  mews_score INTEGER NOT NULL,
  level TEXT NOT NULL,
  vitals JSONB NOT NULL,
  origin_unit TEXT,
  optical_transfers INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Allow anonymous field worker inserts and hospital dashboard reads
CREATE POLICY "Allow public read-write for field triage" 
ON public.patients FOR ALL 
USING (true) 
WITH CHECK (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
`.trim();
