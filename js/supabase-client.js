import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

if (CONFIG.SUPABASE_URL.includes('PEGA_AQUI') || CONFIG.SUPABASE_ANON_KEY.includes('PEGA_AQUI')) {
  console.warn('Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js');
}

// persistSession:false garantiza que Supabase Auth no escriba la sesión en localStorage.
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
