import { CardData, GameState, PlayerColor, Position } from '../types/game';
import { ICardRepository } from '../repositories/cardRepo';
import { GameEngine } from './gameEngine';

export class MatchService {
  constructor(private cardRepo: ICardRepository) {}

  async createMatch(
    matchId: string,
    blueDeckIds: string[],
    redDeckIds: string[]
  ): Promise<GameState> {
    const [blueHand, redHand] = await Promise.all([
      this.cardRepo.getCardsByIds(blueDeckIds),
      this.cardRepo.getCardsByIds(redDeckIds),
    ]);

    return {
      matchId,
      board: GameEngine.createEmptyBoard(),
      currentTurn: 'BLUE',
      hands: {
        BLUE: blueHand,
        RED: redHand,
      },
      scores: {
        BLUE: 0,
        RED: 0,
      },
      isGameOver: false,
      winner: null,
    };
  }

  async createQuickRandomMatch(matchId: string): Promise<GameState> {
    const allCards = await this.cardRepo.getAllCards();
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);

    const blueHand: CardData[] = shuffled.slice(0, 5);
    const redHand: CardData[] = shuffled.slice(5, 10);

    return {
      matchId,
      board: GameEngine.createEmptyBoard(),
      currentTurn: 'BLUE',
      hands: {
        BLUE: blueHand,
        RED: redHand,
      },
      scores: {
        BLUE: 0,
        RED: 0,
      },
      isGameOver: false,
      winner: null,
    };
  }

  playTurn(
    state: GameState,
    player: PlayerColor,
    cardIndexInHand: number,
    position: Position
  ): GameState {
    if (state.isGameOver) {
      throw new Error('A partida já foi encerrada.');
    }

    if (state.currentTurn !== player) {
      throw new Error(`Turno inválido. Aguardando jogador ${state.currentTurn}.`);
    }

    const currentHand = state.hands[player];
    const selectedCard = currentHand[cardIndexInHand];

    if (!selectedCard) {
      throw new Error('Carta selecionada não existe na mão.');
    }

    const updatedBoard = GameEngine.processMove(
      state.board,
      position,
      selectedCard,
      player
    );

    const updatedPlayerHand = currentHand.filter((_, idx) => idx !== cardIndexInHand);
    const updatedHands = {
      ...state.hands,
      [player]: updatedPlayerHand,
    };

    const scores = GameEngine.calculateScores(updatedBoard);
    const totalCardsOnBoard = scores.BLUE + scores.RED;
    const isGameOver = totalCardsOnBoard === 9;

    let winner: PlayerColor | 'DRAW' | null = null;
    if (isGameOver) {
      if (scores.BLUE > scores.RED) winner = 'BLUE';
      else if (scores.RED > scores.BLUE) winner = 'RED';
      else winner = 'DRAW';
    }

    return {
      ...state,
      board: updatedBoard,
      hands: updatedHands,
      scores,
      currentTurn: player === 'BLUE' ? 'RED' : 'BLUE',
      isGameOver,
      winner,
    };
  }
}
