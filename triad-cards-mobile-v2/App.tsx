import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MockCardRepository } from './src/repositories/cardRepo';
import { MatchService } from './src/services/matchService';
import { GameState, Position } from './src/types/game';
import { BoardView } from './src/components/BoardView';
import { PlayerHand } from './src/components/PlayerHand';

export default function App() {
  const matchService = useMemo(() => {
    const repo = new MockCardRepository();
    return new MatchService(repo);
  }, []);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  const startNewGame = useCallback(async () => {
    const initialState = await matchService.createQuickRandomMatch(
      `match-${Date.now()}`
    );
    setGameState(initialState);
    setSelectedCardIndex(null);
  }, [matchService]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const handleSelectSlot = (position: Position) => {
    if (!gameState || selectedCardIndex === null || gameState.isGameOver) return;

    try {
      const nextState = matchService.playTurn(
        gameState,
        gameState.currentTurn,
        selectedCardIndex,
        position
      );
      setGameState(nextState);
      setSelectedCardIndex(null);
    } catch (error) {
      console.warn(error);
    }
  };

  if (!gameState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  const getWinnerMessage = () => {
    if (gameState.winner === 'BLUE') return 'Vitória do Jogador Azul!';
    if (gameState.winner === 'RED') return 'Vitória do Jogador Vermelho!';
    return 'Empate!';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Placar Superior */}
      <View style={styles.scoreboard}>
        <View style={[styles.scoreBadge, styles.blueBadge]}>
          <Text style={styles.scoreLabel}>AZUL</Text>
          <Text style={styles.scoreValue}>{gameState.scores.BLUE}</Text>
        </View>

        <View style={styles.turnIndicator}>
          <Text style={styles.turnTitle}>
            {gameState.isGameOver
              ? 'FIM DE JOGO'
              : gameState.currentTurn === 'BLUE'
              ? 'TURNO: AZUL'
              : 'TURNO: VERMELHO'}
          </Text>
          <Text style={styles.turnHint}>
            {gameState.isGameOver
              ? getWinnerMessage()
              : selectedCardIndex === null
              ? 'Escolha uma carta'
              : 'Toque em um slot livre'}
          </Text>
        </View>

        <View style={[styles.scoreBadge, styles.redBadge]}>
          <Text style={styles.scoreLabel}>VERMELHO</Text>
          <Text style={styles.scoreValue}>{gameState.scores.RED}</Text>
        </View>
      </View>

      {/* Mão do Jogador Vermelho (Topo) */}
      <PlayerHand
        player="RED"
        cards={gameState.hands.RED}
        isActiveTurn={!gameState.isGameOver && gameState.currentTurn === 'RED'}
        selectedIndex={selectedCardIndex}
        onSelectCard={setSelectedCardIndex}
      />

      {/* Tabuleiro 3x3 Central */}
      <View style={styles.boardSection}>
        <BoardView
          board={gameState.board}
          hasSelectedCard={selectedCardIndex !== null}
          onSelectSlot={handleSelectSlot}
        />

        {gameState.isGameOver && (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverText}>{getWinnerMessage()}</Text>
            <Text style={styles.finalScoreText}>
              Azul {gameState.scores.BLUE} x {gameState.scores.RED} Vermelho
            </Text>
            <TouchableOpacity style={styles.restartButton} onPress={startNewGame}>
              <Text style={styles.restartButtonText}>Jogar Novamente</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Mão do Jogador Azul (Base) */}
      <PlayerHand
        player="BLUE"
        cards={gameState.hands.BLUE}
        isActiveTurn={!gameState.isGameOver && gameState.currentTurn === 'BLUE'}
        selectedIndex={selectedCardIndex}
        onSelectCard={setSelectedCardIndex}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 32 : 8,
    paddingBottom: 12,
  },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scoreBadge: {
    width: 78,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  blueBadge: {
    backgroundColor: '#1d4ed8',
  },
  redBadge: {
    backgroundColor: '#b91c1c',
  },
  scoreLabel: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '700',
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  turnIndicator: {
    alignItems: 'center',
  },
  turnTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  turnHint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  boardSection: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gameOverOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    width: 280,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#facc15',
  },
  gameOverText: {
    color: '#facc15',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  finalScoreText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 16,
  },
  restartButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  restartButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
