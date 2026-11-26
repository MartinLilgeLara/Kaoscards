import { CardData } from '../types/game';

export interface ICardRepository {
  getAllCards(): Promise<CardData[]>;
  getCardsByIds(ids: string[]): Promise<CardData[]>;
};