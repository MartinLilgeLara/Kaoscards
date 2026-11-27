import { corsHeaders } from '../_shared/cors.ts';
import {
  errorResponse,
  getAdminClient,
  jsonResponse,
  requireUserByToken,
} from '../_shared/supabaseAdmin.ts';

async function applyRankedElo(
  supabase: ReturnType<typeof getAdminClient>,
  winner: 'BLUE' | 'RED',
  bluePlayerId: string,
  redPlayerId: string
) {
  const winnerId = winner === 'BLUE' ? bluePlayerId : redPlayerId;
  const loserId = winner === 'BLUE' ? redPlayerId : bluePlayerId;

  const { data: players } = await supabase
    .from('users')
    .select('id, elo_rating')
    .in('id', [winnerId, loserId]);

  const winnerRow = players?.find((p) => p.id === winnerId);
  const loserRow = players?.find((p) => p.id === loserId);

  if (winnerRow) {
    await supabase
      .from('users')
      .update({ elo_rating: (winnerRow.elo_rating ?? 1000) + 15 })
      .eq('id', winnerId);
  }

  if (loserRow) {
    await supabase
      .from('users')
      .update({ elo_rating: Math.max(0, (loserRow.elo_rating ?? 1000) - 10) })
      .eq('id', loserId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const supabase = getAdminClient();

    // ------------------------------------------------------------------
    // 1. GET_ACTIVE_MATCH (Verifica partida em andamento ou aplica W.O.)
    // ------------------------------------------------------------------
    if (action === 'get_active_match') {
      const sessionToken = String(params.session_token ?? '').trim();
      if (!sessionToken) {
        return jsonResponse({ match: null });
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('session_token', sessionToken)
        .maybeSingle();

      if (!user) {
        return jsonResponse({ match: null });
      }

      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'active')
        .or(`blue_player_id.eq.${user.id},red_player_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!match) {
        return jsonResponse({ match: null });
      }

      const elapsedSec =
        (Date.now() - new Date(match.turn_started_at).getTime()) / 1000;

      // Se passou de 3 minutos (180s) sem movimento, encerra por W.O.
      if (elapsedSec >= 180) {
        const winner: 'BLUE' | 'RED' =
          match.current_turn === 'BLUE' ? 'RED' : 'BLUE';
        const nowIso = new Date().toISOString();
        const currentLog = Array.isArray(match.turns_log) ? match.turns_log : [];

        const { data: updated } = await supabase
          .from('matches')
          .update({
            status: 'abandoned',
            winner,
            finished_at: nowIso,
            turns_log: [
              ...currentLog,
              {
                turn: match.turn_number,
                player: match.current_turn,
                event: 'INACTIVITY_TIMEOUT_3M',
                timestamp: nowIso,
              },
            ],
          })
          .eq('id', match.id)
          .eq('status', 'active')
          .select('*')
          .maybeSingle();

        if (updated && match.is_ranked) {
          await applyRankedElo(
            supabase,
            winner,
            match.blue_player_id,
            match.red_player_id
          );
        }

        return jsonResponse({ match: null });
      }

      return jsonResponse({ match });
    }

    // Demais ações exigem sessão válida
    const user = await requireUserByToken(supabase, params.session_token);

    // ------------------------------------------------------------------
    // 2. CREATE_MATCH (Cria partida ranqueada ou sala privada)
    // ------------------------------------------------------------------
    if (action === 'create_match') {
      const roomCode = String(params.room_code ?? '').trim();
      const isRanked = Boolean(params.is_ranked);
      const blueId = String(params.blue_id ?? '');
      const redId = String(params.red_id ?? '');
      const blueDeck = Array.isArray(params.blue_deck) ? params.blue_deck : [];
      const redDeck = Array.isArray(params.red_deck) ? params.red_deck : [];

      if (!roomCode || !blueId || !redId) {
        return errorResponse('Dados inválidos para criar partida.');
      }

      // Evita duplicação caso ambos os clientes enviem criação na mesma janela de 20s
      const twentySecondsAgo = new Date(Date.now() - 20_000).toISOString();
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('room_code', roomCode)
        .eq('status', 'active')
        .gt('created_at', twentySecondsAgo)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        return jsonResponse({ id: existing.id });
      }

      const { data: usersData } = await supabase
        .from('users')
        .select('id, username')
        .in('id', [blueId, redId]);

      const blueName =
        usersData?.find((u) => u.id === blueId)?.username || 'Azul';
      const redName =
        usersData?.find((u) => u.id === redId)?.username || 'Vermelho';

      const { data: created, error: createError } = await supabase
        .from('matches')
        .insert({
          room_code: roomCode,
          is_ranked: isRanked,
          blue_player_id: blueId,
          red_player_id: redId,
          blue_username: blueName,
          red_username: redName,
          blue_deck_ids: blueDeck,
          red_deck_ids: redDeck,
        })
        .select('id')
        .single();

      if (createError || !created) {
        return errorResponse(createError?.message || 'Erro ao criar partida.');
      }

      return jsonResponse({ id: created.id });
    }

    // ------------------------------------------------------------------
    // 3. SUBMIT_TURN (Registra jogada, vira turno e finaliza no turno 9)
    // ------------------------------------------------------------------
    if (action === 'submit_turn') {
      const matchId = String(params.match_id ?? '');
      const cardIndex = Number(params.card_index);
      const cardId = String(params.card_id ?? '');
      const cellIndex = Number(params.cell_index);
      const newBoard = Array.isArray(params.new_board) ? params.new_board : [];
      const flippedIndices = Array.isArray(params.flipped_indices)
        ? params.flipped_indices
        : [];

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (matchError || !match || match.status !== 'active') {
        return errorResponse('Partida não está ativa.');
      }

      let playerSide: 'BLUE' | 'RED';
      if (match.blue_player_id === user.id) {
        playerSide = 'BLUE';
      } else if (match.red_player_id === user.id) {
        playerSide = 'RED';
      } else {
        return errorResponse('Você não participa desta partida.');
      }

      if (match.current_turn !== playerSide) {
        return errorResponse('Não é o seu turno.');
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const timeSpentMs = Math.max(
        0,
        Math.round(now - new Date(match.turn_started_at).getTime())
      );

      const logEntry = {
        turn: match.turn_number,
        player: playerSide,
        card_id: cardId,
        cell_index: cellIndex,
        flipped_indices: flippedIndices,
        time_spent_ms: timeSpentMs,
        timestamp: nowIso,
      };

      const blueUsed = [...(match.blue_used_indices ?? [])];
      const redUsed = [...(match.red_used_indices ?? [])];

      if (playerSide === 'BLUE') {
        blueUsed.push(cardIndex);
      } else {
        redUsed.push(cardIndex);
      }

      const currentLog = Array.isArray(match.turns_log) ? match.turns_log : [];
      const nextLog = [...currentLog, logEntry];

      // Fim de partida no 9º turno
      if (match.turn_number >= 9) {
        const blueBoard = newBoard.filter((c: any) => c?.owner === 'BLUE').length;
        const redBoard = newBoard.filter((c: any) => c?.owner === 'RED').length;

        let winner: 'BLUE' | 'RED' | 'DRAW' = 'DRAW';
        if (blueBoard > redBoard) winner = 'BLUE';
        else if (redBoard > blueBoard) winner = 'RED';

        const { data: updated, error: finishError } = await supabase
          .from('matches')
          .update({
            board_state: newBoard,
            blue_used_indices: blueUsed,
            red_used_indices: redUsed,
            turns_log: nextLog,
            status: 'finished',
            winner,
            finished_at: nowIso,
          })
          .eq('id', matchId)
          .eq('status', 'active')
          .eq('turn_number', match.turn_number)
          .select('*')
          .maybeSingle();

        if (finishError || !updated) {
          return errorResponse('Erro ao finalizar partida.');
        }

        if (match.is_ranked && winner !== 'DRAW') {
          await applyRankedElo(
            supabase,
            winner,
            match.blue_player_id,
            match.red_player_id
          );
        }

        return jsonResponse({ match: updated });
      }

      // Turno intermediário (1 a 8)
      const nextTurnSide = playerSide === 'BLUE' ? 'RED' : 'BLUE';

      const { data: updated, error: turnError } = await supabase
        .from('matches')
        .update({
          board_state: newBoard,
          blue_used_indices: blueUsed,
          red_used_indices: redUsed,
          turns_log: nextLog,
          turn_number: match.turn_number + 1,
          current_turn: nextTurnSide,
          turn_started_at: nowIso,
        })
        .eq('id', matchId)
        .eq('status', 'active')
        .eq('turn_number', match.turn_number)
        .select('*')
        .maybeSingle();

      if (turnError || !updated) {
        return errorResponse('Erro ao registrar jogada.');
      }

      return jsonResponse({ match: updated });
    }

    // ------------------------------------------------------------------
    // 4. EXPIRE_INACTIVE_MATCH (Encerra partida após 3 min de inatividade)
    // ------------------------------------------------------------------
    if (action === 'expire_inactive_match') {
      const matchId = String(params.match_id ?? '');

      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (!match || match.status !== 'active') {
        return jsonResponse({ match });
      }

      const elapsedSec =
        (Date.now() - new Date(match.turn_started_at).getTime()) / 1000;

      // Só encerra se realmente já passaram ~3 minutos (179s)
      if (elapsedSec < 179) {
        return jsonResponse({ match });
      }

      const winner: 'BLUE' | 'RED' =
        match.current_turn === 'BLUE' ? 'RED' : 'BLUE';
      const nowIso = new Date().toISOString();
      const currentLog = Array.isArray(match.turns_log) ? match.turns_log : [];

      const { data: updated } = await supabase
        .from('matches')
        .update({
          status: 'abandoned',
          winner,
          finished_at: nowIso,
          turns_log: [
            ...currentLog,
            {
              turn: match.turn_number,
              player: match.current_turn,
              event: 'INACTIVITY_TIMEOUT_3M',
              timestamp: nowIso,
            },
          ],
        })
        .eq('id', matchId)
        .eq('status', 'active')
        .select('*')
        .maybeSingle();

      // Se outro cliente encerrou milissegundos antes, apenas retorna o registro já salvo
      if (!updated) {
        const { data: alreadyClosed } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();
        return jsonResponse({ match: alreadyClosed });
      }

      if (match.is_ranked) {
        await applyRankedElo(
          supabase,
          winner,
          match.blue_player_id,
          match.red_player_id
        );
      }

      return jsonResponse({ match: updated });
    }

    return errorResponse('Ação inválida no módulo match.');
  } catch (err: any) {
    return errorResponse(err?.message || 'Erro interno no servidor.', 400);
  }
});