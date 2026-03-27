const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const envFunctionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME?.trim();

function deriveProjectIdFromUrl(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

const derivedProjectId = deriveProjectIdFromUrl(envUrl);

export const supabaseProjectId = derivedProjectId;
export const supabaseUrl = envUrl || '';
export const supabaseAnonKey = envAnonKey || '';
export const supabaseFunctionName = envFunctionName || 'server';
export const supabaseFunctionsBaseUrl = `${supabaseUrl}/functions/v1/${supabaseFunctionName}`;

export function validateSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
  }
}
