import { CardData } from '../types/game';

export interface ICardRepository {
  getAllCards(): Promise<CardData[]>;
  getCardsByIds(ids: string[]): Promise<CardData[]>;
}

const MOCK_CATALOG: CardData[] = [
  { id: 'c1', name: 'Recruta', stats: { north: 3, east: 4, south: 2, west: 3 } },
  { id: 'c2', name: 'Sentinela', stats: { north: 5, east: 2, south: 4, west: 3 } },
  { id: 'c3', name: 'Batedor', stats: { north: 2, east: 6, south: 3, west: 4 } },
  { id: 'c4', name: 'Guardião', stats: { north: 4, east: 4, south: 5, west: 4 } },
  { id: 'c5', name: 'Piromante', stats: { north: 6, east: 3, south: 2, west: 5 } },
  { id: 'c6', name: 'Criomante', stats: { north: 3, east: 5, south: 6, west: 2 } },
  { id: 'c7', name: 'Assassino', stats: { north: 7, east: 2, south: 1, west: 6 } },
  { id: 'c8', name: 'Paladino', stats: { north: 5, east: 5, south: 5, west: 4 } },
  { id: 'c9', name: 'Arqueiro', stats: { north: 4, east: 7, south: 3, west: 2 } },
  { id: 'c10', name: 'Dragão', stats: { north: 8, east: 4, south: 3, west: 6 } },
];

export class MockCardRepository implements ICardRepository {
  private cards: Map<string, CardData>;

  constructor() {
    this.cards = new Map(MOCK_CATALOG.map((card) => [card.id, card]));
  }

  async getAllCards(): Promise<CardData[]> {
    return Array.from(this.cards.values());
  }

  async getCardsByIds(ids: string[]): Promise<CardData[]> {
    return ids
      .map((id) => this.cards.get(id))
      .filter((card): card is CardData => Boolean(card));
  }
}
