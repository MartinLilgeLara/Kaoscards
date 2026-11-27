import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export async function requireUserByToken(
  supabase: ReturnType<typeof getAdminClient>,
  sessionToken?: string | null
) {
  if (!sessionToken || !sessionToken.trim()) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('session_token', sessionToken)
    .maybeSingle();

  if (error || !user) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }

  return user;
}