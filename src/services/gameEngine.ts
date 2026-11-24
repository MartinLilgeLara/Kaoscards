import { Board, CardData, PlayedCard, PlayerColor, Position } from '../types/game';

export class GameEngine {
  static createEmptyBoard(): Board {
    return Array.from({ length: 3 }, () => Array<PlayedCard | null>(3).fill(null));
  }

  static processMove(
    currentBoard: Board,
    position: Position,
    card: CardData,
    player: PlayerColor
  ): Board {
    const { row, col } = position;

    if (row < 0 || row > 2 || col < 0 || col > 2) {
      throw new Error('Posição fora do tabuleiro.');
    }

    if (currentBoard[row][col] !== null) {
      throw new Error('Este slot já está ocupado.');
    }

    const newBoard: Board = currentBoard.map((r) => [...r]);
    newBoard[row][col] = { ...card, owner: player };

    const neighbors: {
      r: number;
      c: number;
      attackerStat: number;
      defenderSide: keyof CardData['stats'];
    }[] = [
      { r: row - 1, c: col, attackerStat: card.stats.north, defenderSide: 'south' },
      { r: row + 1, c: col, attackerStat: card.stats.south, defenderSide: 'north' },
      { r: row, c: col + 1, attackerStat: card.stats.east, defenderSide: 'west' },
      { r: row, c: col - 1, attackerStat: card.stats.west, defenderSide: 'east' },
    ];

    for (const neighbor of neighbors) {
      const { r, c, attackerStat, defenderSide } = neighbor;

      if (r >= 0 && r < 3 && c >= 0 && c < 3) {
        const targetCard = newBoard[r][c];

        if (targetCard && targetCard.owner !== player) {
          const defenderStat = targetCard.stats[defenderSide];

          if (attackerStat > defenderStat) {
            newBoard[r][c] = { ...targetCard, owner: player };
          }
        }
      }
    }

    return newBoard;
  }

  static calculateScores(board: Board): Record<PlayerColor, number> {
    const scores: Record<PlayerColor, number> = { BLUE: 0, RED: 0 };

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const slot = board[r][c];
        if (slot) {
          scores[slot.owner] += 1;
        }
      }
    }

    return scores;
  }
}
