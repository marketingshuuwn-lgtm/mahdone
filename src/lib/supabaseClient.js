import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] لم يتم ضبط VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'انسخ .env.example إلى .env وأدخل بيانات مشروعك.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
