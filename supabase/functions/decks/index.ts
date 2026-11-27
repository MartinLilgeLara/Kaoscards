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
    const user = await requireUserByToken(supabase, params.session_token);

    // ------------------------------------------------------------------
    // 1. SAVE_DECK (Criar ou atualizar baralho)
    // ------------------------------------------------------------------
    if (action === 'save_deck') {
      const deckId: string | null = params.deck_id || null;
      const cardIds: string[] = Array.isArray(params.card_ids) ? params.card_ids : [];
      const equip = Boolean(params.equip);

      if (cardIds.length !== 5) {
        return errorResponse('O baralho precisa ter exatamente 5 cartas.');
      }

      if (new Set(cardIds).size !== 5) {
        return errorResponse('O baralho não pode conter cartas repetidas.');
      }

      // Garante que o jogador possui todas as 5 cartas no inventário
      const { data: ownedRows, error: invError } = await supabase
        .from('user_inventory')
        .select('card_id')
        .eq('user_id', user.id)
        .in('card_id', cardIds);

      if (invError || (ownedRows?.length ?? 0) !== 5) {
        return errorResponse('Você só pode equipar cartas que possui no inventário.');
      }

      const cleanName = String(params.name ?? '').trim() || 'Baralho sem nome';

      if (equip) {
        await supabase
          .from('decks')
          .update({ is_active: false })
          .eq('user_id', user.id);
      }

      // Criar novo baralho
      if (!deckId) {
        const { count: deckCount } = await supabase
          .from('decks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if ((deckCount ?? 0) >= 5) {
          return errorResponse('Você atingiu o limite máximo de 5 baralhos.');
        }

        const { data: activeDecks } = await supabase
          .from('decks')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        const hasActive = (activeDecks?.length ?? 0) > 0;
        const shouldEquip = equip || !hasActive;

        const { data: inserted, error: insertError } = await supabase
          .from('decks')
          .insert({
            user_id: user.id,
            name: cleanName,
            card_ids: cardIds,
            is_active: shouldEquip,
          })
          .select('id')
          .single();

        if (insertError || !inserted) {
          return errorResponse(insertError?.message || 'Erro ao criar baralho.');
        }

        return jsonResponse({ id: inserted.id });
      }

      // Atualizar baralho existente
      const updatePayload: Record<string, unknown> = {
        name: cleanName,
        card_ids: cardIds,
        updated_at: new Date().toISOString(),
      };
      if (equip) {
        updatePayload.is_active = true;
      }

      const { data: updated, error: updateError } = await supabase
        .from('decks')
        .update(updatePayload)
        .eq('id', deckId)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();

      if (updateError || !updated) {
        return errorResponse('Baralho não encontrado.');
      }

      return jsonResponse({ id: updated.id });
    }

    // ------------------------------------------------------------------
    // 2. SET_ACTIVE_DECK (Equipar um baralho salvo)
    // ------------------------------------------------------------------
    if (action === 'set_active_deck') {
      const deckId = String(params.deck_id ?? '').trim();
      if (!deckId) {
        return errorResponse('Baralho não informado.');
      }

      const { data: targetDeck, error: findError } = await supabase
        .from('decks')
        .select('id, card_ids')
        .eq('id', deckId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (findError || !targetDeck) {
        return errorResponse('Baralho não encontrado.');
      }

      await supabase
        .from('decks')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .neq('id', deckId);

      await supabase
        .from('decks')
        .update({ is_active: true })
        .eq('id', deckId)
        .eq('user_id', user.id);

      return jsonResponse({ card_ids: targetDeck.card_ids });
    }

    return errorResponse('Ação inválida no módulo decks.');
  } catch (err: any) {
    return errorResponse(err?.message || 'Erro interno no servidor.', 400);
  }
});