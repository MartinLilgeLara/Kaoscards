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
  blue_image_url?: string | null;
  red_image_url?: string | null;
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
export interface BoardCell {
  card: CardData;
  owner: 'BLUE' | 'RED';
}

export interface MatchRecord {
  id: string;
  room_code: string;
  is_ranked: boolean;
  status: 'active' | 'finished' | 'abandoned';
  blue_player_id: string;
  red_player_id: string;
  blue_username: string;
  red_username: string;
  blue_deck_ids: string[];
  red_deck_ids: string[];
  current_turn: 'BLUE' | 'RED';
  turn_number: number;
  board_state: (BoardCell | null)[];
  blue_used_indices: number[];
  red_used_indices: number[];
  winner: 'BLUE' | 'RED' | 'DRAW' | null;
  turn_started_at: string;
  turns_log?: any[];
  finished_at?: string | null;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  elo_rating: number;
  role: string;
  ranked_wins: number;
  ranked_matches: number;
}