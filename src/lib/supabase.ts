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

export async function invokeEdge<T = any>(
  functionName: string,
  body: Record<string, any>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    let message = error.message || 'Erro ao comunicar com o servidor.';
    try {
      const errJson = await (error as any).context?.json();
      if (errJson?.error) message = errJson.error;
    } catch {}
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}