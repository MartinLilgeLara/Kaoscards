import { corsHeaders } from '../_shared/cors.ts';
import {
  errorResponse,
  getAdminClient,
  jsonResponse,
  requireUserByToken,
} from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const supabase = getAdminClient();

    // ------------------------------------------------------------------
    // 1. GET_LEADERBOARD (Top 20 jogadores por Elo, vitórias e nome)
    // ------------------------------------------------------------------
    if (action === 'get_leaderboard') {
      const [{ data: users, error: usersError }, { data: rankedMatches, error: matchesError }] =
        await Promise.all([
          supabase.from('users').select('id, username, elo_rating, role'),
          supabase
            .from('matches')
            .select('blue_player_id, red_player_id, winner')
            .eq('is_ranked', true)
            .in('status', ['finished', 'abandoned']),
        ]);

      if (usersError || matchesError) {
        return errorResponse('Erro ao carregar dados do ranking.');
      }

      const statsMap = new Map<string, { wins: number; matches: number }>();

      for (const m of rankedMatches ?? []) {
        if (m.blue_player_id) {
          const cur = statsMap.get(m.blue_player_id) ?? { wins: 0, matches: 0 };
          cur.matches += 1;
          if (m.winner === 'BLUE') cur.wins += 1;
          statsMap.set(m.blue_player_id, cur);
        }
        if (m.red_player_id) {
          const cur = statsMap.get(m.red_player_id) ?? { wins: 0, matches: 0 };
          cur.matches += 1;
          if (m.winner === 'RED') cur.wins += 1;
          statsMap.set(m.red_player_id, cur);
        }
      }

      const leaderboard = (users ?? [])
        .map((u) => {
          const st = statsMap.get(u.id) ?? { wins: 0, matches: 0 };
          return {
            id: u.id,
            username: u.username,
            elo_rating: u.elo_rating,
            role: u.role,
            ranked_wins: st.wins,
            ranked_matches: st.matches,
          };
        })
        .sort((a, b) => {
          if (b.elo_rating !== a.elo_rating) return b.elo_rating - a.elo_rating;
          if (b.ranked_wins !== a.ranked_wins) return b.ranked_wins - a.ranked_wins;
          return a.username.localeCompare(b.username);
        })
        .slice(0, 20);

      return jsonResponse({ leaderboard });
    }

    // ------------------------------------------------------------------
    // 2. GET_MATCH_HISTORY (Últimas 10 partidas encerradas/abandonadas)
    // ------------------------------------------------------------------
    if (action === 'get_match_history') {
      const user = await requireUserByToken(supabase, params.session_token);

      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['finished', 'abandoned'])
        .or(`blue_player_id.eq.${user.id},red_player_id.eq.${user.id}`)
        .order('finished_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return errorResponse(error.message || 'Erro ao carregar histórico.');
      }

      return jsonResponse({ matches: matches ?? [] });
    }

    return errorResponse('Ação inválida no módulo stats.');
  } catch (err: any) {
    return errorResponse(err?.message || 'Erro interno no servidor.', 400);
  }
});