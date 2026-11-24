export type PlayerColor = 'BLUE' | 'RED';

export interface CardStats {
  north: number;
  east: number;
  south: number;
  west: number;
}

export interface CardData {
  id: string;
  name: string;
  stats: CardStats;
}

export interface PlayedCard extends CardData {
  owner: PlayerColor;
}

export interface Position {
  row: number;
  col: number;
}

export type BoardSlot = PlayedCard | null;
export type Board = BoardSlot[][];

export interface GameState {
  matchId: string;
  board: Board;
  currentTurn: PlayerColor;
  hands: Record<PlayerColor, CardData[]>;
  playerNames: Record<PlayerColor, string>;
  scores: Record<PlayerColor, number>;
  isGameOver: boolean;
  winner: PlayerColor | 'DRAW' | null;
}

export interface UserProfile {
  id: string;
  username: string;
  role: 'student' | 'mentor_admin';
  elo_rating: number;
  deck_ids?: string[];
}

export interface InventoryItem {
  inventoryId: string;
  card: CardData;
}
export interface UserProfile {
  id: string;
  username: string;
  role: 'student' | 'mentor_admin';
  elo_rating: number;
  session_token?: string;
}
export interface SavedDeck {
  id: string;
  name: string;
  card_ids: string[];
  is_active: boolean;
}