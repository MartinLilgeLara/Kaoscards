import bcrypt from 'npm:bcryptjs@2.4.3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  errorResponse,
  getAdminClient,
  jsonResponse,
} from '../_shared/supabaseAdmin.ts';

function generateSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const supabase = getAdminClient();

    // ------------------------------------------------------------------
    // 1. REGISTER_USER
    // ------------------------------------------------------------------
    if (action === 'register') {
      const cleanUsername = String(params.username ?? '').trim().toLowerCase();
      const password = String(params.password ?? '');

      if (cleanUsername.length < 3 || password.length < 4) {
        return errorResponse('Usuário deve ter 3+ letras e senha 4+ caracteres.');
      }

      const token = generateSessionToken();
      const passwordHash = bcrypt.hashSync(password, 6);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          username: cleanUsername,
          password_hash: passwordHash,
          session_token: token,
        })
        .select('*')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          return errorResponse('Este nome de usuário já está em uso.');
        }
        return errorResponse(insertError.message || 'Erro ao cadastrar usuário.');
      }

      // Busca todas as cartas starter
      const { data: starterCards } = await supabase
        .from('cards')
        .select('id')
        .eq('rarity', 'starter');

      const starterIds = (starterCards ?? []).map((c) => c.id);

      if (starterIds.length > 0) {
        await supabase.from('user_inventory').upsert(
          starterIds.map((cardId) => ({
            user_id: newUser.id,
            card_id: cardId,
          })),
          { onConflict: 'user_id,card_id', ignoreDuplicates: true }
        );
      }

      const initialDeckIds = starterIds.slice(0, 5);

      await supabase.from('decks').insert({
        user_id: newUser.id,
        card_ids: initialDeckIds,
      });

      return jsonResponse({
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        elo_rating: newUser.elo_rating,
        session_token: token,
        deck_ids: initialDeckIds,
      });
    }

    // ------------------------------------------------------------------
    // 2. LOGIN_USER
    // ------------------------------------------------------------------
    if (action === 'login') {
      const cleanUsername = String(params.username ?? '').trim().toLowerCase();
      const password = String(params.password ?? '');

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (userError || !user || !bcrypt.compareSync(password, user.password_hash)) {
        return errorResponse('Usuário ou senha inválidos.');
      }

      // Gera novo token para invalidar sessões em outros aparelhos
      const token = generateSessionToken();
      await supabase
        .from('users')
        .update({ session_token: token })
        .eq('id', user.id);

      const { data: decks } = await supabase
        .from('decks')
        .select('card_ids')
        .eq('user_id', user.id)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1);

      const deckIds = decks?.[0]?.card_ids ?? [];

      return jsonResponse({
        id: user.id,
        username: user.username,
        role: user.role,
        elo_rating: user.elo_rating,
        session_token: token,
        deck_ids: deckIds,
      });
    }

    // ------------------------------------------------------------------
    // 3. CHECK_SESSION
    // ------------------------------------------------------------------
    if (action === 'check_session') {
      const sessionToken = String(params.session_token ?? '').trim();
      if (!sessionToken) {
        return jsonResponse({ valid: false });
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('session_token', sessionToken)
        .maybeSingle();

      return jsonResponse({ valid: Boolean(user) });
    }

    return errorResponse('Ação inválida no módulo auth.');
  } catch (err: any) {
    return errorResponse(err?.message || 'Erro interno no servidor.', 500);
  }
});