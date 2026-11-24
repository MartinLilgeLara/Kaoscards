import { supabase } from '../lib/supabase';
import { CardData, InventoryItem, SavedDeck } from '../types/game';
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
}