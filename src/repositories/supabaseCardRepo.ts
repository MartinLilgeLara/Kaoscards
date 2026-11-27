import { invokeEdge, supabase } from '../lib/supabase';
import {
  CardData,
  InventoryItem,
  LeaderboardEntry,
  MatchRecord,
  SavedDeck,
} from '../types/game';
import { ICardRepository } from './cardRepo';

function mapRowToCardData(row: any): CardData {
  return {
    id: row.id,
    name: row.name,
    stats: {
      north: row.north,
      east: row.east,
      south: row.south,
      west: row.west,
    },
    blue_image_url: row.blue_image_url ?? null,
    red_image_url: row.red_image_url ?? null,
  };
}

export class SupabaseCardRepository implements ICardRepository {
  async getAllCards(): Promise<CardData[]> {
    const { data, error } = await supabase.from('cards').select('*');
    if (error || !data) {
      throw new Error(error?.message || 'Erro ao carregar catálogo de cartas.');
    }

    return data.map(mapRowToCardData);
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
      data.map((row) => [row.id, mapRowToCardData(row)])
    );

    return ids
      .map((id) => map.get(id))
      .filter((card): card is CardData => Boolean(card));
  }

  async getUserInventory(userId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('user_inventory')
      .select(
        'id, cards (id, name, north, east, south, west, blue_image_url, red_image_url)'
      )
      .eq('user_id', userId);

    if (error || !data) {
      throw new Error(error?.message || 'Erro ao buscar inventário do usuário.');
    }

    return data
      .filter((row: any) => row.cards)
      .map((row: any) => ({
        inventoryId: row.id,
        card: mapRowToCardData(row.cards),
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

    const data = await invokeEdge<{ id: string }>('decks', {
      action: 'save_deck',
      session_token: sessionToken,
      deck_id: deckId,
      name,
      card_ids: cardIds,
      equip,
    });

    return data.id;
  }

  async setActiveDeck(sessionToken: string, deckId: string): Promise<string[]> {
    const data = await invokeEdge<{ card_ids: string[] }>('decks', {
      action: 'set_active_deck',
      session_token: sessionToken,
      deck_id: deckId,
    });

    return data.card_ids;
  }

  async getActiveMatch(sessionToken: string): Promise<MatchRecord | null> {
    try {
      const data = await invokeEdge<{ match: MatchRecord | null }>('match', {
        action: 'get_active_match',
        session_token: sessionToken,
      });
      return data?.match ?? null;
    } catch {
      return null;
    }
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
    const data = await invokeEdge<{ id: string }>('match', {
      action: 'create_match',
      session_token: sessionToken,
      room_code: roomCode,
      is_ranked: isRanked,
      blue_id: blueId,
      red_id: redId,
      blue_deck: blueDeck,
      red_deck: redDeck,
    });

    return data.id;
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
    const data = await invokeEdge<{ match: MatchRecord }>('match', {
      action: 'submit_turn',
      session_token: sessionToken,
      match_id: matchId,
      card_index: cardIndex,
      card_id: cardId,
      cell_index: cellIndex,
      new_board: newBoard,
      flipped_indices: flippedIndices,
    });

    return data.match;
  }

  async expireInactiveMatch(
    sessionToken: string,
    matchId: string
  ): Promise<MatchRecord> {
    const data = await invokeEdge<{ match: MatchRecord }>('match', {
      action: 'expire_inactive_match',
      session_token: sessionToken,
      match_id: matchId,
    });

    return data.match;
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
    try {
      const data = await invokeEdge<{ valid: boolean }>('auth', {
        action: 'check_session',
        session_token: sessionToken,
      });
      return Boolean(data?.valid);
    } catch {
      return true; // Evita deslogar em queda momentânea de rede
    }
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const data = await invokeEdge<{ leaderboard: LeaderboardEntry[] }>('stats', {
      action: 'get_leaderboard',
    });
    return data.leaderboard ?? [];
  }

  async getMatchHistory(sessionToken: string): Promise<MatchRecord[]> {
    const data = await invokeEdge<{ matches: MatchRecord[] }>('stats', {
      action: 'get_match_history',
      session_token: sessionToken,
    });
    return data.matches ?? [];
  }
}