import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { MockCardRepository } from './src/repositories/cardRepo';
import { SupabaseCardRepository } from './src/repositories/supabaseCardRepo';
import { MatchService } from './src/services/matchService';
import { RoomService } from './src/services/roomService';
import { GameState, PlayerColor, Position, UserProfile } from './src/types/game';
import { BoardView } from './src/components/BoardView';
import { PlayerHand } from './src/components/PlayerHand';
import { AuthScreen } from './src/screens/AuthScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { DeckBuilderScreen } from './src/screens/DeckBuilderScreen';

type Screen = 'AUTH' | 'LOBBY' | 'DECK' | 'MATCH';

export default function App() {
  const supabaseRepo = useMemo(() => new SupabaseCardRepository(), []);
  const onlineMatchService = useMemo(() => new MatchService(supabaseRepo), [supabaseRepo]);
  const localMatchService = useMemo(() => new MatchService(new MockCardRepository()), []);

  const [screen, setScreen] = useState<Screen>('AUTH');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [deckIds, setDeckIds] = useState<string[]>([]);

  // Estados de Lobby / Matchmaking
  const [waitingStatus, setWaitingStatus] = useState<string | null>(null);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Estados da Partida
  const [isOnlineMatch, setIsOnlineMatch] = useState(false);
  const [myColor, setMyColor] = useState<PlayerColor>('BLUE');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const eloUpdatedRef = useRef(false);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setWaitingStatus(null);
    setActiveRoomCode(null);
  }, []);

  useEffect(() => {
    return () => cleanupChannel();
  }, [cleanupChannel]);

  // Carrega o baralho salvo assim que o usuário loga
  const handleAuthenticated = async (loggedUser: UserProfile) => {
  setUser(loggedUser);
  setScreen('LOBBY');

  if (loggedUser.deck_ids && loggedUser.deck_ids.length === 5) {
    setDeckIds(loggedUser.deck_ids);
    return;
  }

  try {
    const savedIds = await supabaseRepo.getSavedDeckIds(loggedUser.id);
    setDeckIds(savedIds);
  } catch (e) {
    console.warn(e);
  }
};

  // Atualiza Elo ao terminar partida online
  useEffect(() => {
    if (!isOnlineMatch || !gameState?.isGameOver || !user || eloUpdatedRef.current) {
      return;
    }

    eloUpdatedRef.current = true;
    const delta =
      gameState.winner === 'DRAW'
        ? 0
        : gameState.winner === myColor
        ? 15
        : -15;

    if (delta !== 0 && user.session_token) {
      const nextElo = Math.max(0, user.elo_rating + delta);
      setUser({ ...user, elo_rating: nextElo });
      supabaseRepo.updateUserElo(user.session_token, delta);
    }
  }, [gameState, isOnlineMatch, myColor, supabaseRepo, user]);

  // Inicia conexão em uma sala específica (usada tanto por código quanto pela fila)
  const enterOnlineRoom = (roomCode: string, assignedRole: PlayerColor) => {
    if (!user) return;
    cleanupChannel();

    setMyColor(assignedRole);
    setIsOnlineMatch(true);
    setActiveRoomCode(roomCode);
    eloUpdatedRef.current = false;
    setWaitingStatus(
      assignedRole === 'BLUE'
        ? 'Aguardando oponente entrar na sala...'
        : `Conectando à sala ${roomCode}...`
    );

    const roomChannel = RoomService.connectToRoom({
      roomCode,
      role: assignedRole,
      user,
      deckIds,
      onGuestJoined: async (guest) => {
        if (assignedRole !== 'BLUE') return;
        const initialState = await onlineMatchService.createMatch(
          roomCode,
          deckIds,
          guest.deckIds,
          { BLUE: user.username, RED: guest.username }
        );
        setGameState(initialState);
        setSelectedCardIndex(null);
        setWaitingStatus(null);
        setScreen('MATCH');
        await RoomService.broadcastState(roomChannel, initialState);
      },
      onStateSync: (syncedState) => {
        setGameState(syncedState);
        setSelectedCardIndex(null);
        setWaitingStatus(null);
        setScreen('MATCH');
      },
    });

    channelRef.current = roomChannel;
  };

  const handleFindQuickMatch = () => {
    if (!user) return;
    cleanupChannel();
    setWaitingStatus('Procurando oponente na fila...');

    const queueChannel = RoomService.joinQuickQueue({
      user,
      onMatchFound: (roomCode, assignedRole) => {
        enterOnlineRoom(roomCode, assignedRole);
      },
    });

    channelRef.current = queueChannel;
  };

  const handleCreateRoom = () => {
    const code = RoomService.generateRoomCode();
    enterOnlineRoom(code, 'BLUE');
  };

  const handleJoinRoom = (code: string) => {
    enterOnlineRoom(code, 'RED');
  };

  // Modo Local Pass-and-Play (Offline)
  const startLocalMatch = async () => {
    cleanupChannel();
    setIsOnlineMatch(false);
    setMyColor('BLUE');
    const initialState = await localMatchService.createQuickRandomMatch(
      `local-${Date.now()}`
    );
    setGameState(initialState);
    setSelectedCardIndex(null);
    setScreen('MATCH');
  };

  const handleSelectSlot = async (position: Position) => {
    if (!gameState || selectedCardIndex === null || gameState.isGameOver) return;

    if (isOnlineMatch && gameState.currentTurn !== myColor) {
      return;
    }

    try {
      const service = isOnlineMatch ? onlineMatchService : localMatchService;
      const nextState = service.playTurn(
        gameState,
        gameState.currentTurn,
        selectedCardIndex,
        position
      );

      setGameState(nextState);
      setSelectedCardIndex(null);

      if (isOnlineMatch && channelRef.current) {
        await RoomService.broadcastState(channelRef.current, nextState);
      }
    } catch (error) {
      console.warn(error);
    }
  };

  const handleExitMatch = () => {
    cleanupChannel();
    setGameState(null);
    setSelectedCardIndex(null);
    setScreen(user ? 'LOBBY' : 'AUTH');
  };

  if (screen === 'AUTH') {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          onStartOfflineTest={startLocalMatch}
        />
      </>
    );
  }

  if (screen === 'DECK' && user) {
    return (
      <>
        <StatusBar style="light" />
        <DeckBuilderScreen
          sessionToken={user.session_token || ''}
          userId={user.id}
          repo={supabaseRepo}
          onDeckSaved={(newIds) => {
            setDeckIds(newIds);
            setScreen('LOBBY');
          }}
          onBack={() => setScreen('LOBBY')}
        />
      </>
    );
  }

  if (screen === 'LOBBY' && user) {
    return (
      <>
        <StatusBar style="light" />
        <LobbyScreen
          user={user}
          deckReady={deckIds.length === 5}
          waitingStatus={waitingStatus}
          activeRoomCode={activeRoomCode}
          onOpenDeckBuilder={() => setScreen('DECK')}
          onFindQuickMatch={handleFindQuickMatch}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onCancelWaiting={cleanupChannel}
          onStartLocalTest={startLocalMatch}
          onLogout={() => {
            cleanupChannel();
            setUser(null);
            setDeckIds([]);
            setScreen('AUTH');
          }}
        />
      </>
    );
  }

  if (!gameState) return null;

  // Em partida online, sempre posiciona a própria mão na base e a do oponente no topo
  const bottomPlayer: PlayerColor = isOnlineMatch ? myColor : 'BLUE';
  const topPlayer: PlayerColor = bottomPlayer === 'BLUE' ? 'RED' : 'BLUE';

  const canPlayNow =
    !gameState.isGameOver &&
    (!isOnlineMatch || gameState.currentTurn === myColor);

  const getWinnerMessage = () => {
    if (gameState.winner === 'DRAW') return 'Empate!';
    if (gameState.winner === 'BLUE') {
      return `Vitória de ${gameState.playerNames.BLUE}!`;
    }
    return `Vitória de ${gameState.playerNames.RED}!`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Placar Superior */}
      <View style={styles.scoreboard}>
        <View style={[styles.scoreBadge, styles.blueBadge]}>
          <Text style={styles.scoreLabel} numberOfLines={1}>
            {gameState.playerNames.BLUE}
          </Text>
          <Text style={styles.scoreValue}>{gameState.scores.BLUE}</Text>
        </View>

        <View style={styles.turnIndicator}>
          <Text style={styles.turnTitle}>
            {gameState.isGameOver
              ? 'FIM DE JOGO'
              : `TURNO: ${gameState.playerNames[gameState.currentTurn].toUpperCase()}`}
          </Text>
          <Text style={styles.turnHint}>
            {gameState.isGameOver
              ? getWinnerMessage()
              : !canPlayNow
              ? 'Aguardando oponente...'
              : selectedCardIndex === null
              ? 'Escolha uma carta'
              : 'Toque em um slot livre'}
          </Text>
        </View>

        <View style={[styles.scoreBadge, styles.redBadge]}>
          <Text style={styles.scoreLabel} numberOfLines={1}>
            {gameState.playerNames.RED}
          </Text>
          <Text style={styles.scoreValue}>{gameState.scores.RED}</Text>
        </View>
      </View>

      {/* Mão Superior */}
      <PlayerHand
        player={topPlayer}
        playerName={gameState.playerNames[topPlayer]}
        cards={gameState.hands[topPlayer]}
        isActiveTurn={!gameState.isGameOver && gameState.currentTurn === topPlayer}
        canInteract={!isOnlineMatch && !gameState.isGameOver && gameState.currentTurn === topPlayer}
        hideCards={isOnlineMatch}
        selectedIndex={selectedCardIndex}
        onSelectCard={setSelectedCardIndex}
      />

      {/* Tabuleiro 3x3 Central */}
      <View style={styles.boardSection}>
        <BoardView
          board={gameState.board}
          hasSelectedCard={canPlayNow && selectedCardIndex !== null}
          onSelectSlot={handleSelectSlot}
        />

        {gameState.isGameOver && (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverText}>{getWinnerMessage()}</Text>
            <Text style={styles.finalScoreText}>
              {gameState.playerNames.BLUE} {gameState.scores.BLUE} x{' '}
              {gameState.scores.RED} {gameState.playerNames.RED}
            </Text>
            {isOnlineMatch && (
              <Text style={styles.eloDeltaText}>
                {gameState.winner === 'DRAW'
                  ? 'Elo inalterado (0)'
                  : gameState.winner === myColor
                  ? '+15 Pontos de Elo!'
                  : '-15 Pontos de Elo'}
              </Text>
            )}
            <TouchableOpacity
              style={styles.restartButton}
              onPress={isOnlineMatch ? handleExitMatch : startLocalMatch}
            >
              <Text style={styles.restartButtonText}>
                {isOnlineMatch ? 'Voltar ao Lobby' : 'Jogar Novamente'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Mão Inferior */}
      <PlayerHand
        player={bottomPlayer}
        playerName={gameState.playerNames[bottomPlayer]}
        cards={gameState.hands[bottomPlayer]}
        isActiveTurn={!gameState.isGameOver && gameState.currentTurn === bottomPlayer}
        canInteract={!gameState.isGameOver && gameState.currentTurn === bottomPlayer}
        selectedIndex={selectedCardIndex}
        onSelectCard={setSelectedCardIndex}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    width: 86,
    paddingVertical: 6,
    paddingHorizontal: 4,
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
    flex: 1,
    paddingHorizontal: 6,
  },
  turnTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  turnHint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  boardSection: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gameOverOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    width: 286,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#facc15',
  },
  gameOverText: {
    color: '#facc15',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  finalScoreText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 8,
    textAlign: 'center',
  },
  eloDeltaText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
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
