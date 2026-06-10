import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://enamvoamthbfimtsvgqa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CpzqeLlInSe81L1Sq46rQQ_NJSmTnP1';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or Anon Key missing in environment. Using fallback values provided in code.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
