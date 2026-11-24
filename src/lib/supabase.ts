import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://auzducmbonumgyvevlqi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_SauTqcTiKr7-J34kRubiXw_2dT-uzUf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
