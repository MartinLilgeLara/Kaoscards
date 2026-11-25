import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CardView } from '../components/CardView';
import { SupabaseCardRepository } from '../repositories/supabaseCardRepo';
import { BoardCell, CardData, SavedDeck } from '../types/game';

interface LocalMatchScreenProps {
  blueDeck: SavedDeck;
  redDeck: SavedDeck;
  repo: SupabaseCardRepository;
  onExit: () => void;
}

export function LocalMatchScreen({
  blueDeck,
  redDeck,
  repo,
  onExit,
}: LocalMatchScreenProps) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [blueCards, setBlueCards] = useState<CardData[]>([]);
  const [redCards, setRedCards] = useState<CardData[]>([]);
  const [board, setBoard] = useState<(BoardCell | null)[]>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<'BLUE' | 'RED'>('BLUE');
  const [blueUsed, setBlueUsed] = useState<number[]>([]);
  const [redUsed, setRedUsed] = useState<number[]>([]);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadDecks() {
      const [bCards, rCards] = await Promise.all([
        repo.getCardsByIds(blueDeck.card_ids),
        repo.getCardsByIds(redDeck.card_ids),
      ]);
      if (!mounted) return;
      setBlueCards(bCards);
      setRedCards(rCards);
      setLoading(false);
    }
    loadDecks();
    return () => {
      mounted = false;
    };
  }, [blueDeck, redDeck, repo]);

  const resetLocalMatch = () => {
    setBoard(Array(9).fill(null));
    setCurrentTurn('BLUE');
    setBlueUsed([]);
    setRedUsed([]);
    setSelectedCardIdx(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const containerWidth = Math.min(winWidth, 520);
  const handHeight = winHeight < 660 ? 70 : 84;
  const maxBoardByHeight = winHeight - (handHeight * 2 + 165);
  const maxBoardByWidth = containerWidth - 24;
  const boardSize = Math.max(210, Math.min(maxBoardByWidth, maxBoardByHeight, 360));

    const blueScore = board.filter((c) => c?.owner === 'BLUE').length;
    const redScore = board.filter((c) => c?.owner === 'RED').length;

  const isGameOver = blueUsed.length + redUsed.length >= 9;
  const winner: 'BLUE' | 'RED' | 'DRAW' | null = !isGameOver
    ? null
    : blueScore > redScore
    ? 'BLUE'
    : redScore > blueScore
    ? 'RED'
    : 'DRAW';

  const resolveCaptures = (
    currentBoard: (BoardCell | null)[],
    placedIdx: number,
    placedCard: CardData,
    owner: 'BLUE' | 'RED'
  ) => {
    const nextBoard = [...currentBoard];
    const row = Math.floor(placedIdx / 3);
    const col = placedIdx % 3;

    const checks = [
      { cond: row > 0, target: placedIdx - 3, atk: placedCard.stats.north, defKey: 'south' as const },
      { cond: row < 2, target: placedIdx + 3, atk: placedCard.stats.south, defKey: 'north' as const },
      { cond: col > 0, target: placedIdx - 1, atk: placedCard.stats.west, defKey: 'east' as const },
      { cond: col < 2, target: placedIdx + 1, atk: placedCard.stats.east, defKey: 'west' as const },
    ];

    for (const chk of checks) {
      if (!chk.cond) continue;
      const neighbor = nextBoard[chk.target];
      if (neighbor && neighbor.owner !== owner) {
        if (chk.atk > neighbor.card.stats[chk.defKey]) {
          nextBoard[chk.target] = { ...neighbor, owner };
        }
      }
    }

    return nextBoard;
  };

  const handleCellPress = (cellIdx: number) => {
    if (isGameOver || selectedCardIdx === null || board[cellIdx] !== null) return;

    const activeCards = currentTurn === 'BLUE' ? blueCards : redCards;
    const chosenCard = activeCards[selectedCardIdx];
    if (!chosenCard) return;

    const boardWithCard = [...board];
    boardWithCard[cellIdx] = { card: chosenCard, owner: currentTurn };
    const nextBoard = resolveCaptures(
      boardWithCard,
      cellIdx,
      chosenCard,
      currentTurn
    );

    setBoard(nextBoard);
    if (currentTurn === 'BLUE') {
      setBlueUsed([...blueUsed, selectedCardIdx]);
      setCurrentTurn('RED');
    } else {
      setRedUsed([...redUsed, selectedCardIdx]);
      setCurrentTurn('BLUE');
    }
    setSelectedCardIdx(null);
  };

  return (
    <View style={styles.container}>
      {/* Scoreboard */}
      <View style={styles.hud}>
        <View style={styles.playerTag}>
          <Text numberOfLines={1} style={styles.redLabel}>
            Vermelho • {redDeck.name}
          </Text>
          <Text style={styles.scoreNumber}>{redScore}</Text>
        </View>

        <View style={styles.centerHud}>
          <Text style={styles.modeTag}>LOCAL</Text>
          <TouchableOpacity onPress={onExit} style={styles.exitSmallBtn}>
            <Text style={styles.exitSmallText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.playerTag, { alignItems: 'flex-end' }]}>
          <Text numberOfLines={1} style={styles.blueLabel}>
            Azul • {blueDeck.name}
          </Text>
          <Text style={styles.scoreNumber}>{blueScore}</Text>
        </View>
      </View>

      <Text style={styles.turnText}>
        {isGameOver
          ? 'Fim de jogo!'
          : currentTurn === 'BLUE'
          ? '🔵 Vez do Jogador Azul'
          : '🔴 Vez do Jogador Vermelho'}
      </Text>

      {/* Red Player Hand (Top) */}
      <View style={[styles.handRow, { height: handHeight }]}>
        {redCards.map((card, idx) => {
          const used = redUsed.includes(idx);
          const isTurn = !isGameOver && currentTurn === 'RED';
          const isSelected = isTurn && selectedCardIdx === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.handSlot, used && styles.usedSlot]}
              disabled={!isTurn || used}
              onPress={() => setSelectedCardIdx(isSelected ? null : idx)}
            >
              {!used && (
                <CardView
                  card={card}
                  owner="RED"
                  isSelected={isSelected}
                  compact
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3x3 Board */}
      <View style={[styles.board, { width: boardSize, height: boardSize }]}>
        {board.map((cell, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.cell}
            disabled={isGameOver || cell !== null || selectedCardIdx === null}
            onPress={() => handleCellPress(idx)}
          >
            {cell && <CardView card={cell.card} owner={cell.owner} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Blue Player Hand (Bottom) */}
      <View style={[styles.handRow, { height: handHeight }]}>
        {blueCards.map((card, idx) => {
          const used = blueUsed.includes(idx);
          const isTurn = !isGameOver && currentTurn === 'BLUE';
          const isSelected = isTurn && selectedCardIdx === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.handSlot, used && styles.usedSlot]}
              disabled={!isTurn || used}
              onPress={() => setSelectedCardIdx(isSelected ? null : idx)}
            >
              {!used && (
                <CardView
                  card={card}
                  owner="BLUE"
                  isSelected={isSelected}
                  compact
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* End Game Modal */}
      {isGameOver && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.resultTitle}>
              {winner === 'DRAW'
                ? 'EMPATE!'
                : winner === 'BLUE'
                ? 'AZUL VENCEU!'
                : 'VERMELHO VENCEU!'}
            </Text>
            <Text style={styles.finalScoreText}>
              Azul {blueScore} × {redScore} Vermelho
            </Text>

            <TouchableOpacity style={styles.rematchBtn} onPress={resetLocalMatch}>
              <Text style={styles.modalBtnText}>🔄 Jogar Novamente</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.lobbyBtn} onPress={onExit}>
              <Text style={styles.modalBtnText}>Voltar ao Lobby</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 22,
    paddingHorizontal: 12,
    paddingBottom: 14,
    justifyContent: 'space-between',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  playerTag: {
    flex: 1,
  },
  blueLabel: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '800',
  },
  redLabel: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '800',
  },
  scoreNumber: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  centerHud: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  modeTag: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
  },
  exitSmallBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  exitSmallText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },
  turnText: {
    color: '#facc15',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  handRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  handSlot: {
    flex: 1,
    height: '100%',
  },
  usedSlot: {
    opacity: 0.18,
  },
  board: {
    alignSelf: 'center',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cell: {
    width: '31.5%',
    height: '31.5%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 18,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  resultTitle: {
    color: '#facc15',
    fontSize: 26,
    fontWeight: '900',
  },
  finalScoreText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  rematchBtn: {
    width: '100%',
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  lobbyBtn: {
    width: '100%',
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
});