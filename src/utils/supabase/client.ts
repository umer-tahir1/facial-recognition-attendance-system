import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl, validateSupabaseConfig } from './config';

let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    validateSupabaseConfig();
    supabaseInstance = createSupabaseClient(
      supabaseUrl,
      supabaseAnonKey
    );
  }
  return supabaseInstance;
}
