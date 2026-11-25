import { supabase } from '../lib/supabase';
import { CardData, InventoryItem, SavedDeck, MatchRecord } from '../types/game';
import { ICardRepository } from './cardRepo';

export class SupabaseCardRepository implements ICardRepository {
  async getAllCards(): Promise<CardData[]> {
    const { data, error } = await supabase.from('cards').select('*');
    if (error || !data) {
      throw new Error(error?.message || 'Erro ao carregar catálogo de cartas.');
    }

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      stats: {
        north: row.north,
        east: row.east,
        south: row.south,
        west: row.west,
      },
    }));
  }

  async getCardsByIds(ids: string[]): Promise<CardData[]> {
    if (!ids.length) return [];

    const uniqueIds = Array.from(new Set(ids));
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .in('id', uniqueIds);

    if (error || !data) return [];

    const map = new Map<string, CardData>(
      data.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          stats: {
            north: row.north,
            east: row.east,
            south: row.south,
            west: row.west,
          },
        },
      ])
    );

    return ids
      .map((id) => map.get(id))
      .filter((card): card is CardData => Boolean(card));
  }

  async getUserInventory(userId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('id, cards (id, name, north, east, south, west)')
      .eq('user_id', userId);

    if (error || !data) {
      throw new Error(error?.message || 'Erro ao buscar inventário do usuário.');
    }

    return data
      .filter((row: any) => row.cards)
      .map((row: any) => ({
        inventoryId: row.id,
        card: {
          id: row.cards.id,
          name: row.cards.name,
          stats: {
            north: row.cards.north,
            east: row.cards.east,
            south: row.cards.south,
            west: row.cards.west,
          },
        },
      }));
  }

  async getUserDecks(userId: string): Promise<SavedDeck[]> {
    const { data, error } = await supabase
      .from('decks')
      .select('id, name, card_ids, is_active')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error || !data) {
      throw new Error(error?.message || 'Erro ao carregar baralhos salvos.');
    }

    return data as SavedDeck[];
  }

  async getSavedDeckIds(userId: string): Promise<string[]> {
    const decks = await this.getUserDecks(userId);
    const activeDeck = decks.find((d) => d.is_active) || decks[0];

    if (activeDeck?.card_ids && activeDeck.card_ids.length === 5) {
      return activeDeck.card_ids;
    }

    const inventory = await this.getUserInventory(userId);
    return inventory.slice(0, 5).map((item) => item.card.id);
  }

  async saveDeck(
    sessionToken: string,
    deckId: string | null,
    name: string,
    cardIds: string[],
    equip = false
  ): Promise<string> {
    if (cardIds.length !== 5) {
      throw new Error('O baralho precisa ter exatamente 5 cartas.');
    }

    const { data, error } = await supabase.rpc('save_deck', {
      p_session_token: sessionToken,
      p_deck_id: deckId,
      p_name: name,
      p_card_ids: cardIds,
      p_equip: equip,
    });

    if (error) {
      throw new Error(error.message || 'Falha ao salvar o baralho no banco.');
    }

    return data as string;
  }

  async setActiveDeck(sessionToken: string, deckId: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('set_active_deck', {
      p_session_token: sessionToken,
      p_deck_id: deckId,
    });

    if (error) {
      throw new Error(error.message || 'Falha ao equipar o baralho.');
    }

    return data as string[];
  }

  async updateUserElo(sessionToken: string, delta: number): Promise<void> {
    await supabase.rpc('update_elo', {
      p_session_token: sessionToken,
      p_delta: delta,
    });
  }
  async getActiveMatch(sessionToken: string): Promise<MatchRecord | null> {
    const { data, error } = await supabase.rpc('get_active_match', {
      p_session_token: sessionToken,
    });
    if (error || !data) return null;
    return data as MatchRecord;
  }

  async getMatchById(matchId: string): Promise<MatchRecord> {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error || !data) {
      throw new Error('Partida não encontrada.');
    }
    return data as MatchRecord;
  }

  async createMatch(
    sessionToken: string,
    roomCode: string,
    isRanked: boolean,
    blueId: string,
    redId: string,
    blueDeck: string[],
    redDeck: string[]
  ): Promise<string> {
    const { data, error } = await supabase.rpc('create_match', {
      p_session_token: sessionToken,
      p_room_code: roomCode,
      p_is_ranked: isRanked,
      p_blue_id: blueId,
      p_red_id: redId,
      p_blue_deck: blueDeck,
      p_red_deck: redDeck,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Erro ao criar partida.');
    }
    return data as string;
  }

  async submitTurn(
    sessionToken: string,
    matchId: string,
    cardIndex: number,
    cardId: string,
    cellIndex: number,
    newBoard: any[],
    flippedIndices: number[]
  ): Promise<MatchRecord> {
    const { data, error } = await supabase.rpc('submit_turn', {
      p_session_token: sessionToken,
      p_match_id: matchId,
      p_card_index: cardIndex,
      p_card_id: cardId,
      p_cell_index: cellIndex,
      p_new_board: newBoard,
      p_flipped_indices: flippedIndices,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Erro ao enviar jogada.');
    }
    return data as MatchRecord;
  }

  async expireInactiveMatch(
    sessionToken: string,
    matchId: string
  ): Promise<MatchRecord> {
    const { data, error } = await supabase.rpc('expire_inactive_match', {
      p_session_token: sessionToken,
      p_match_id: matchId,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Erro ao encerrar partida inativa.');
    }
    return data as MatchRecord;
  }

  async getUserProfile(userId: string): Promise<{ elo_rating: number }> {
    const { data } = await supabase
      .from('users')
      .select('elo_rating')
      .eq('id', userId)
      .single();
    return { elo_rating: data?.elo_rating ?? 1000 };
  }
  async checkSession(sessionToken: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_session', {
      p_session_token: sessionToken,
    });
    if (error) return true; // Evita deslogar em queda momentânea de rede
    return Boolean(data);
  }
}
