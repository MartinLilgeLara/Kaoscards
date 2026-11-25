import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CardView } from '../components/CardView';
import { supabase } from '../lib/supabase';
import { SupabaseCardRepository } from '../repositories/supabaseCardRepo';
import { BoardCell, CardData, MatchRecord } from '../types/game';

interface MatchScreenProps {
  matchId: string;
  user: {
    id: string;
    username: string;
    session_token: string;
  };
  repo: SupabaseCardRepository;
  onExitMatch: () => void;
}

const INACTIVITY_LIMIT_SEC = 180; // 3 minutos
const WARNING_THRESHOLD_SEC = 60; // Mostra timer nos últimos 60s

export function MatchScreen({
  matchId,
  user,
  repo,
  onExitMatch,
}: MatchScreenProps) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [blueCards, setBlueCards] = useState<CardData[]>([]);
  const [redCards, setRedCards] = useState<CardData[]>([]);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(INACTIVITY_LIMIT_SEC);
  const [submitting, setSubmitting] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  const [currentMatchId, setCurrentMatchId] = useState<string>(matchId);

  const expireTriggeredRef = useRef<string | null>(null);
  const rematchChannelRef = useRef<any>(null);

  useEffect(() => {
    setCurrentMatchId(matchId);
  }, [matchId]);

  useEffect(() => {
    let mounted = true;
    setMatch(null);
    setSelectedCardIdx(null);
    setRematchRequested(false);
    setOpponentWantsRematch(false);

    async function loadMatch() {
      const m = await repo.getMatchById(currentMatchId);
      if (!mounted) return;
      setMatch(m);

      const [bCards, rCards] = await Promise.all([
        repo.getCardsByIds(m.blue_deck_ids),
        repo.getCardsByIds(m.red_deck_ids),
      ]);
      if (!mounted) return;
      setBlueCards(bCards);
      setRedCards(rCards);
    }

    loadMatch();

    const dbChannel = supabase
      .channel(`match_db_${currentMatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${currentMatchId}`,
        },
        (payload) => {
          if (mounted && payload.new) {
            setMatch(payload.new as MatchRecord);
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(async () => {
      try {
        const latest = await repo.getMatchById(currentMatchId);
        if (mounted) setMatch(latest);
      } catch {}
    }, 3000);

    return () => {
      mounted = false;
      supabase.removeChannel(dbChannel);
      clearInterval(pollInterval);
    };
  }, [currentMatchId, repo]);

  // Canal de Revanche Rápida para salas privadas
  useEffect(() => {
    if (!match || match.is_ranked) return;

    const channel = supabase.channel(`rematch_${match.id}`);
    channel
      .on('broadcast', { event: 'REMATCH_PING' }, ({ payload }) => {
        if (payload.from !== user.id) {
          setOpponentWantsRematch(true);
        }
      })
      .on('broadcast', { event: 'REMATCH_START' }, ({ payload }) => {
        if (payload.newMatchId) {
          setCurrentMatchId(payload.newMatchId);
        }
      })
      .subscribe();

    rematchChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      rematchChannelRef.current = null;
    };
  }, [match?.id, match?.is_ranked, user.id]);

  // Verifica o limite de 3 minutos de inatividade
  useEffect(() => {
    if (!match || match.status !== 'active') return;

    const tick = async () => {
      const startedMs = new Date(match.turn_started_at).getTime();
      const diffSec = Math.floor((Date.now() - startedMs) / 1000);
      const remaining = Math.max(0, INACTIVITY_LIMIT_SEC - diffSec);
      setSecondsLeft(remaining);

      const expireKey = `${match.id}_${match.turn_number}`;
      if (remaining === 0 && expireTriggeredRef.current !== expireKey) {
        expireTriggeredRef.current = expireKey;
        try {
          const updated = await repo.expireInactiveMatch(
            user.session_token,
            match.id
          );
          setMatch(updated);
        } catch {
          expireTriggeredRef.current = null;
        }
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [match, user.session_token, repo]);

  if (!match || blueCards.length === 0 || redCards.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Sincronizando arena...</Text>
      </View>
    );
  }

  // Cálculo responsivo para caber em qualquer altura/largura de tela sem cortar
  const containerWidth = Math.min(winWidth, 520);
  const handHeight = winHeight < 660 ? 70 : 84;
  const maxBoardByHeight = winHeight - (handHeight * 2 + 165);
  const maxBoardByWidth = containerWidth - 24;
  const boardSize = Math.max(210, Math.min(maxBoardByWidth, maxBoardByHeight, 360));

  const mySide: 'BLUE' | 'RED' =
    match.blue_player_id === user.id ? 'BLUE' : 'RED';
  const oppSide: 'BLUE' | 'RED' = mySide === 'BLUE' ? 'RED' : 'BLUE';
  const isMyTurn = match.status === 'active' && match.current_turn === mySide;

  const myCards = mySide === 'BLUE' ? blueCards : redCards;
  const oppCards = mySide === 'BLUE' ? redCards : blueCards;
  const myUsed =
    mySide === 'BLUE' ? match.blue_used_indices : match.red_used_indices;
  const oppUsed =
    mySide === 'BLUE' ? match.red_used_indices : match.blue_used_indices;

  const board = match.board_state;
  const myScore = board.filter((c) => c?.owner === mySide).length;
const oppScore = board.filter((c) => c?.owner === oppSide).length;

  const resolveCaptures = (
    currentBoard: (BoardCell | null)[],
    placedIdx: number,
    placedCard: CardData,
    owner: 'BLUE' | 'RED'
  ) => {
    const nextBoard = [...currentBoard];
    const flipped: number[] = [];
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
          flipped.push(chk.target);
        }
      }
    }

    return { nextBoard, flipped };
  };

  const handleCellPress = async (cellIdx: number) => {
    if (!isMyTurn || submitting || selectedCardIdx === null) return;
    if (board[cellIdx] !== null) return;

    const chosenCard = myCards[selectedCardIdx];
    if (!chosenCard) return;

    setSubmitting(true);
    try {
      const boardWithCard = [...board];
      boardWithCard[cellIdx] = { card: chosenCard, owner: mySide };

      const { nextBoard, flipped } = resolveCaptures(
        boardWithCard,
        cellIdx,
        chosenCard,
        mySide
      );

      const updated = await repo.submitTurn(
        user.session_token,
        match.id,
        selectedCardIdx,
        chosenCard.id,
        cellIdx,
        nextBoard,
        flipped
      );

      setSelectedCardIdx(null);
      setMatch(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRematchClick = async () => {
    if (!rematchChannelRef.current || submitting) return;
    setRematchRequested(true);

    await rematchChannelRef.current.send({
      type: 'broadcast',
      event: 'REMATCH_PING',
      payload: { from: user.id },
    });

    if (opponentWantsRematch) {
      setSubmitting(true);
      try {
        const newMatchId = await repo.createMatch(
          user.session_token,
          `${match.room_code}-R${Date.now().toString().slice(-3)}`,
          false,
          match.red_player_id,
          match.blue_player_id,
          match.red_deck_ids,
          match.blue_deck_ids
        );

        await rematchChannelRef.current.send({
          type: 'broadcast',
          event: 'REMATCH_START',
          payload: { newMatchId },
        });

        setCurrentMatchId(newMatchId);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const oppName =
    mySide === 'BLUE' ? match.red_username : match.blue_username;
  const isExpiring =
    match.status === 'active' && secondsLeft <= WARNING_THRESHOLD_SEC;

  return (
    <View style={styles.container}>
      {/* Scoreboard Header */}
      <View style={styles.hud}>
        <View style={styles.playerTag}>
          <Text numberOfLines={1} style={styles.playerName}>
            {oppName} ({oppSide === 'BLUE' ? 'Azul' : 'Vermelho'})
          </Text>
          <Text style={styles.scoreNumber}>{oppScore}</Text>
        </View>

        <View style={styles.centerHud}>
          <Text style={styles.modeTag}>
            {match.is_ranked ? 'RANQUEADA' : 'CASUAL'}
          </Text>
          <Text style={styles.turnCounter}>Turno {match.turn_number}/9</Text>
        </View>

        <View style={[styles.playerTag, { alignItems: 'flex-end' }]}>
          <Text numberOfLines={1} style={styles.playerName}>
            Você ({mySide === 'BLUE' ? 'Azul' : 'Vermelho'})
          </Text>
          <Text style={styles.scoreNumber}>{myScore}</Text>
        </View>
      </View>

      {/* Turn Indicator + Timer apenas quando faltam <= 60s para os 3 minutos */}
      <View style={styles.turnBanner}>
        <Text style={styles.turnText}>
          {isMyTurn
            ? 'Seu turno! Escolha uma carta e toque no tabuleiro'
            : `Aguardando jogada de ${oppName}...`}
        </Text>

        {isExpiring && (
          <View style={styles.expiringBadge}>
            <Text style={styles.expiringText}>
              ⏳ Tempo expirando: {secondsLeft}s
            </Text>
          </View>
        )}
      </View>

      {/* Opponent Hand */}
      <View style={[styles.handRow, { height: handHeight }]}>
        {oppCards.map((_, idx) => {
          const used = oppUsed.includes(idx);
          return (
            <View
              key={idx}
              style={[
                styles.cardBack,
                oppSide === 'BLUE' ? styles.blueBack : styles.redBack,
                used && styles.usedSlot,
              ]}
            >
              {!used && <Text style={styles.cardBackLogo}>K</Text>}
            </View>
          );
        })}
      </View>

      {/* Responsive 3x3 Arena Grid */}
      <View style={[styles.board, { width: boardSize, height: boardSize }]}>
        {board.map((cell, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.cell}
            disabled={!isMyTurn || cell !== null || submitting}
            onPress={() => handleCellPress(idx)}
          >
            {cell && <CardView card={cell.card} owner={cell.owner} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Player Hand */}
      <View style={[styles.handRow, { height: handHeight }]}>
        {myCards.map((card, idx) => {
          const used = myUsed.includes(idx);
          const isSelected = selectedCardIdx === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.handSlot, used && styles.usedSlot]}
              disabled={!isMyTurn || used || submitting}
              onPress={() => setSelectedCardIdx(isSelected ? null : idx)}
            >
              {!used && (
                <CardView
                  card={card}
                  owner={mySide}
                  isSelected={isSelected}
                  compact
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Game Over Overlay */}
      {match.status !== 'active' && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.resultTitle}>
              {match.winner === 'DRAW'
                ? 'EMPATE!'
                : match.winner === mySide
                ? 'VITÓRIA!'
                : 'DERROTA!'}
            </Text>

            {match.status === 'abandoned' ? (
              <Text style={styles.finalScoreText}>
                Partida encerrada por inatividade (3 min)
              </Text>
            ) : (
              <Text style={styles.finalScoreText}>
                Você {myScore} × {oppScore} {oppName}
              </Text>
            )}

            <Text style={styles.eloInfoText}>
              {!match.is_ranked
                ? 'Partida Casual • Nenhum ponto de Elo alterado'
                : match.winner === 'DRAW'
                ? 'Empate Ranqueado • 0 Pontos'
                : match.winner === mySide
                ? '+15 Pontos de Elo!'
                : '-10 Pontos de Elo'}
            </Text>

            {!match.is_ranked && (
              <TouchableOpacity
                style={styles.rematchBtn}
                disabled={submitting || (rematchRequested && !opponentWantsRematch)}
                onPress={handleRematchClick}
              >
                <Text style={styles.modalBtnText}>
                  {opponentWantsRematch
                    ? '🔥 Aceitar Revanche Agora!'
                    : rematchRequested
                    ? 'Aguardando oponente aceitar...'
                    : '🔄 Revanche Rápida'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.lobbyBtn} onPress={onExitMatch}>
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
    gap: 10,
  },
  loadingText: {
    color: '#cbd5e1',
    fontWeight: '700',
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
  playerName: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  scoreNumber: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  centerHud: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  modeTag: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '900',
  },
  turnCounter: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  turnBanner: {
    alignItems: 'center',
    gap: 4,
  },
  turnText: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  expiringBadge: {
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  expiringText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '900',
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
  cardBack: {
    flex: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  blueBack: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  redBack: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
  },
  cardBackLogo: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 20,
    fontWeight: '900',
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
    fontSize: 28,
    fontWeight: '900',
  },
  finalScoreText: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  eloInfoText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
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