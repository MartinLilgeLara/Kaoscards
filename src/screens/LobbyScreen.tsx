import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CardView } from '../components/CardView';
import { LeaderboardHistoryModal } from '../components/LeaderboardHistoryModal';
import { supabase } from '../lib/supabase';
import { SupabaseCardRepository } from '../repositories/supabaseCardRepo';
import { CardData, MatchRecord, SavedDeck } from '../types/game';

interface LobbyScreenProps {
  user: {
    id: string;
    username: string;
    elo_rating: number;
    session_token: string;
  };
  savedDecks: SavedDeck[];
  equippedCards: CardData[];
  activeMatch: MatchRecord | null;
  repo: SupabaseCardRepository;
  onMatchReady: (matchId: string) => void;
  onStartLocalMatch: (blueDeck: SavedDeck, redDeck: SavedDeck) => void;
  onOpenDeckBuilder: () => void;
  onLogout: () => void;
}

export function LobbyScreen({
  user,
  savedDecks,
  equippedCards,
  activeMatch,
  repo,
  onMatchReady,
  onStartLocalMatch,
  onOpenDeckBuilder,
  onLogout,
}: LobbyScreenProps) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [statusMode, setStatusMode] = useState<'IDLE' | 'QUEUE' | 'PRIVATE'>('IDLE');
  const [showLocalSetup, setShowLocalSetup] = useState(false);
  const [localBlueDeckId, setLocalBlueDeckId] = useState<string | null>(null);
  const [localRedDeckId, setLocalRedDeckId] = useState<string | null>(null);
  const [statsModalTab, setStatsModalTab] = useState<'RANKING' | 'HISTORY' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const channelRef = useRef<any>(null);
  const creatingRef = useRef(false);

  const equippedDeck =
    savedDecks.find((d) => d.is_active) || savedDecks[0] || null;
  const deckIds = equippedDeck?.card_ids || [];
  const hasValidDeck = deckIds.length === 5;

  useEffect(() => {
    if (equippedDeck) {
      setLocalBlueDeckId((prev) => prev || equippedDeck.id);
      setLocalRedDeckId((prev) => prev || equippedDeck.id);
    }
  }, [equippedDeck?.id]);

  const cleanupChannel = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    creatingRef.current = false;
  };

  useEffect(() => {
    return () => cleanupChannel();
  }, []);

  // 1. Fila Rápida (Valendo Elo)
  const handleStartQuickMatch = () => {
    if (!hasValidDeck || activeMatch) return;
    cleanupChannel();
    setErrorMsg(null);
    setStatusMode('QUEUE');

    const joinedAt = Date.now();
    const channel = supabase.channel('kaos_ranked_queue', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, async () => {
        const state = channel.presenceState();
        const players = Object.values(state)
          .flat()
          .map((p: any) => ({
            userId: p.userId,
            deckIds: p.deckIds,
            joinedAt: p.joinedAt,
          }))
          .filter((p) => p.userId && Array.isArray(p.deckIds) && p.deckIds.length === 5)
          .sort((a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));

        if (players.length >= 2) {
          const p1 = players[0];
          const p2 = players[1];

          if (p1.userId === user.id && !creatingRef.current) {
            creatingRef.current = true;
            try {
              const roomCode = `RNK-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
              const matchId = await repo.createMatch(
                user.session_token,
                roomCode,
                true,
                p1.userId,
                p2.userId,
                p1.deckIds,
                p2.deckIds
              );

              await channel.send({
                type: 'broadcast',
                event: 'MATCH_FOUND',
                payload: { matchId, blueId: p1.userId, redId: p2.userId },
              });

              cleanupChannel();
              onMatchReady(matchId);
            } catch (err: any) {
              creatingRef.current = false;
              setErrorMsg(err.message || 'Erro ao iniciar partida ranqueada.');
            }
          }
        }
      })
      .on('broadcast', { event: 'MATCH_FOUND' }, ({ payload }) => {
        if (payload.blueId === user.id || payload.redId === user.id) {
          cleanupChannel();
          onMatchReady(payload.matchId);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: user.id, deckIds, joinedAt });
        }
      });

    channelRef.current = channel;
  };

  // 2. Criar Sala Privada (Casual)
  const handleCreatePrivateRoom = () => {
    if (!hasValidDeck || activeMatch) return;
    cleanupChannel();
    setErrorMsg(null);

    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setCreatedCode(code);
    setStatusMode('PRIVATE');

    const channel = supabase.channel(`kaos_room_${code}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, async () => {
        const state = channel.presenceState();
        const guests = Object.values(state)
          .flat()
          .filter((p: any) => p.userId && p.userId !== user.id);

        if (guests.length >= 1 && !creatingRef.current) {
          creatingRef.current = true;
          const guest: any = guests[0];
          try {
            const matchId = await repo.createMatch(
              user.session_token,
              code,
              false,
              user.id,
              guest.userId,
              deckIds,
              guest.deckIds
            );

            await channel.send({
              type: 'broadcast',
              event: 'ROOM_START',
              payload: { matchId },
            });

            cleanupChannel();
            onMatchReady(matchId);
          } catch (err: any) {
            creatingRef.current = false;
            setErrorMsg(err.message || 'Erro ao criar sala.');
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: user.id, deckIds });
        }
      });

    channelRef.current = channel;
  };

  // 3. Entrar em Sala Privada por Código (Casual)
  const handleJoinPrivateRoom = () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!hasValidDeck || code.length !== 4 || activeMatch) return;

    cleanupChannel();
    setErrorMsg(null);
    setCreatedCode(code);
    setStatusMode('PRIVATE');

    const channel = supabase.channel(`kaos_room_${code}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('broadcast', { event: 'ROOM_START' }, ({ payload }) => {
        cleanupChannel();
        onMatchReady(payload.matchId);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: user.id, deckIds });
        }
      });

    channelRef.current = channel;
  };

  const handleCancelSearch = () => {
    cleanupChannel();
    setCreatedCode(null);
    setStatusMode('IDLE');
  };

  const handleLaunchLocal = () => {
    const blue = savedDecks.find((d) => d.id === localBlueDeckId) || equippedDeck;
    const red = savedDecks.find((d) => d.id === localRedDeckId) || equippedDeck;
    if (!blue || !red) return;
    setShowLocalSetup(false);
    onStartLocalMatch(blue, red);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.welcomeText}>Olá, {user.username}</Text>
          <Text style={styles.eloBadge}>🏆 {user.elo_rating} Elo</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>KAOS CARDS</Text>

      {/* Preview Visual do Baralho Equipado */}
      <View style={styles.equippedBox}>
        <View style={styles.equippedHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.equippedLabel}>BARALHO EQUIPADO</Text>
            <Text numberOfLines={1} style={styles.equippedName}>
              {equippedDeck ? equippedDeck.name : 'Nenhum baralho equipado'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editDeckBtn}
            onPress={onOpenDeckBuilder}
          >
            <Text style={styles.editDeckBtnText}>🃏 Baralhos</Text>
          </TouchableOpacity>
        </View>

        {equippedCards.length === 5 && (
          <View style={styles.miniCardsRow}>
            {equippedCards.map((card, idx) => (
              <View key={`${card.id}_${idx}`} style={styles.miniCardSlot}>
                <CardView card={card} owner="BLUE" compact />
              </View>
            ))}
          </View>
        )}
      </View>

      {activeMatch ? (
        <View style={styles.reconnectBox}>
          <Text style={styles.reconnectTitle}>⚠️ Partida em Andamento</Text>
          <Text style={styles.reconnectDesc}>
            Você saiu antes do fim da partida contra{' '}
            {activeMatch.blue_player_id === user.id
              ? activeMatch.red_username
              : activeMatch.blue_username}
            .
          </Text>
          <TouchableOpacity
            style={styles.reconnectBtn}
            onPress={() => onMatchReady(activeMatch.id)}
          >
            <Text style={styles.primaryBtnText}>Reconectar Agora</Text>
          </TouchableOpacity>
        </View>
      ) : statusMode !== 'IDLE' ? (
        <View style={styles.waitingBox}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.waitingTitle}>
            {statusMode === 'QUEUE'
              ? 'Buscando oponente na Fila Ranqueada...'
              : `Sala Privada: ${createdCode}`}
          </Text>
          <Text style={styles.waitingSub}>
            {statusMode === 'QUEUE'
              ? 'Partida oficial • Vale pontos de Elo'
              : 'Partida casual • Passe o código para seu colega'}
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSearch}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : showLocalSetup ? (
        /* Seletor de Baralhos para Partida Local */
        <View style={styles.cardSection}>
          <View style={styles.localSetupHeader}>
            <Text style={styles.sectionLabel}>Configurar Partida Local</Text>
            <TouchableOpacity onPress={() => setShowLocalSetup(false)}>
              <Text style={styles.closeLocalText}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sidePickerLabel}>🔵 Baralho do Jogador Azul:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.deckChipRow}>
              {savedDecks.map((deck) => {
                const selected = deck.id === localBlueDeckId;
                return (
                  <TouchableOpacity
                    key={`blue_${deck.id}`}
                    style={[styles.deckChip, selected && styles.blueChipActive]}
                    onPress={() => setLocalBlueDeckId(deck.id)}
                  >
                    <Text style={styles.deckChipText}>{deck.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <Text style={styles.sidePickerLabel}>🔴 Baralho do Jogador Vermelho:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.deckChipRow}>
              {savedDecks.map((deck) => {
                const selected = deck.id === localRedDeckId;
                return (
                  <TouchableOpacity
                    key={`red_${deck.id}`}
                    style={[styles.deckChip, selected && styles.redChipActive]}
                    onPress={() => setLocalRedDeckId(deck.id)}
                  >
                    <Text style={styles.deckChipText}>{deck.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.startLocalBtn}
            onPress={handleLaunchLocal}
          >
            <Text style={styles.primaryBtnText}>Iniciar Duelo Local</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.menuBox}>
          {/* Fila Rápida (Ranqueada) */}
          <TouchableOpacity
            style={[styles.rankedBtn, !hasValidDeck && styles.disabledBtn]}
            disabled={!hasValidDeck}
            onPress={handleStartQuickMatch}
          >
            <Text style={styles.primaryBtnText}>⚔️ Fila Rápida (Ranqueada)</Text>
            <Text style={styles.btnSubText}>+15 / -10 Elo</Text>
          </TouchableOpacity>

          {/* Sala Privada (Casual) */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionLabel}>Sala Privada (Casual • Sem Elo)</Text>
            <TouchableOpacity
              style={[styles.secondaryBtn, !hasValidDeck && styles.disabledBtn]}
              disabled={!hasValidDeck}
              onPress={handleCreatePrivateRoom}
            >
              <Text style={styles.primaryBtnText}>Criar Sala</Text>
            </TouchableOpacity>

            <View style={styles.joinRow}>
              <TextInput
                style={styles.codeInput}
                placeholder="CÓDIGO"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                maxLength={4}
                value={roomCodeInput}
                onChangeText={setRoomCodeInput}
              />
              <TouchableOpacity
                style={[
                  styles.joinBtn,
                  (!hasValidDeck || roomCodeInput.trim().length !== 4) &&
                    styles.disabledBtn,
                ]}
                disabled={!hasValidDeck || roomCodeInput.trim().length !== 4}
                onPress={handleJoinPrivateRoom}
              >
                <Text style={styles.primaryBtnText}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Partida Local (Mesmo Aparelho) */}
          <TouchableOpacity
            style={[styles.localBtn, savedDecks.length === 0 && styles.disabledBtn]}
            disabled={savedDecks.length === 0}
            onPress={() => setShowLocalSetup(true)}
          >
            <Text style={styles.primaryBtnText}>🎮 Partida Local (2 Jogadores)</Text>
            <Text style={styles.localSubText}>
              Escolha qualquer baralho salvo para cada lado
            </Text>
          </TouchableOpacity>

          {/* Ranking e Histórico de Partidas */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={[styles.localBtn, styles.statsBtn]}
              onPress={() => setStatsModalTab('RANKING')}
            >
              <Text style={styles.primaryBtnText}>🏆 Ranking</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.localBtn, styles.statsBtn]}
              onPress={() => setStatsModalTab('HISTORY')}
            >
              <Text style={styles.primaryBtnText}>📜 Histórico</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      <LeaderboardHistoryModal
        visible={statsModalTab !== null}
        initialTab={statsModalTab || 'RANKING'}
        user={user}
        repo={repo}
        onClose={() => setStatsModalTab(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    paddingTop: 32,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  welcomeText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  eloBadge: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  equippedBox: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    gap: 10,
  },
  equippedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  equippedLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  equippedName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  editDeckBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editDeckBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  miniCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 74,
    gap: 6,
  },
  miniCardSlot: {
    flex: 1,
    height: '100%',
  },
  menuBox: {
    gap: 12,
  },
  rankedBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnSubText: {
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cardSection: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  joinRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  joinBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 10,
  },
  localBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  localSubText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statsBtn: {
    flex: 1,
  },
  localSetupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeLocalText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
  },
  sidePickerLabel: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  deckChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deckChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  blueChipActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  redChipActive: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
  },
  deckChipText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  startLocalBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  waitingBox: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  waitingTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  waitingSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelBtnText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  reconnectBox: {
    backgroundColor: '#451a03',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 10,
  },
  reconnectTitle: {
    color: '#fbbf24',
    fontSize: 17,
    fontWeight: '900',
  },
  reconnectDesc: {
    color: '#fef3c7',
    fontSize: 13,
  },
  reconnectBtn: {
    backgroundColor: '#d97706',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
});