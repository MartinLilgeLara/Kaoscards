import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SupabaseCardRepository } from '../repositories/supabaseCardRepo';
import { LeaderboardEntry, MatchRecord } from '../types/game';
import { CardView } from './CardView';

interface LeaderboardHistoryModalProps {
  visible: boolean;
  initialTab: 'RANKING' | 'HISTORY';
  user: {
    id: string;
    username: string;
    session_token: string;
  };
  repo: SupabaseCardRepository;
  onClose: () => void;
}

export function LeaderboardHistoryModal({
  visible,
  initialTab,
  user,
  repo,
  onClose,
}: LeaderboardHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'RANKING' | 'HISTORY'>(initialTab);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, visible]);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);
    setExpandedMatchId(null);

    async function loadData() {
      try {
        const [lb, hist] = await Promise.all([
          repo.getLeaderboard(),
          repo.getMatchHistory(user.session_token),
        ]);
        if (!mounted) return;
        setLeaderboard(lb);
        setHistory(hist);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [visible, user.session_token, repo]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>CENTRAL COMPETITIVA</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'RANKING' && styles.tabActive]}
              onPress={() => setActiveTab('RANKING')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'RANKING' && styles.tabTextActive,
                ]}
              >
                🏆 Ranking Elo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'HISTORY' && styles.tabActive]}
              onPress={() => setActiveTab('HISTORY')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'HISTORY' && styles.tabTextActive,
                ]}
              >
                📜 Últimas 10
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : activeTab === 'RANKING' ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {leaderboard.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum jogador ranqueado ainda.</Text>
              ) : (
                leaderboard.map((entry, idx) => {
                  const isMe = entry.id === user.id;
                  const rankMedal =
                    idx === 0
                      ? '🥇'
                      : idx === 1
                      ? '🥈'
                      : idx === 2
                      ? '🥉'
                      : `#${idx + 1}`;
                  const winrate =
                    entry.ranked_matches > 0
                      ? Math.round((entry.ranked_wins / entry.ranked_matches) * 100)
                      : 0;

                  return (
                    <View
                      key={entry.id}
                      style={[styles.rankRow, isMe && styles.rankRowMe]}
                    >
                      <Text style={styles.rankPos}>{rankMedal}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rankName}>
                          {entry.username} {isMe ? '(Você)' : ''}
                        </Text>
                        <Text style={styles.rankSub}>
                          {entry.ranked_wins}V / {entry.ranked_matches}J ({winrate}%)
                        </Text>
                      </View>
                      <Text style={styles.rankElo}>{entry.elo_rating} Elo</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent}>
              {history.length === 0 ? (
                <Text style={styles.emptyText}>
                  Você ainda não concluiu nenhuma partida online.
                </Text>
              ) : (
                history.map((m) => {
                  const mySide = m.blue_player_id === user.id ? 'BLUE' : 'RED';
                  const oppSide = mySide === 'BLUE' ? 'RED' : 'BLUE';
                  const oppName =
                    mySide === 'BLUE' ? m.red_username : m.blue_username;

                  const myBoard = m.board_state.filter(
                    (c) => c?.owner === mySide
                  ).length;
                  const oppBoard = m.board_state.filter(
                    (c) => c?.owner === oppSide
                  ).length;
                  const myUsed =
                    mySide === 'BLUE'
                      ? m.blue_used_indices.length
                      : m.red_used_indices.length;
                  const oppUsed =
                    oppSide === 'BLUE'
                      ? m.blue_used_indices.length
                      : m.red_used_indices.length;

                    const myScore = myBoard;
                    const oppScore = oppBoard;

                  const isWin = m.winner === mySide;
                  const isDraw = m.winner === 'DRAW';
                  const isExpanded = expandedMatchId === m.id;

                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.85}
                      style={[
                        styles.matchCard,
                        isDraw
                          ? styles.matchDraw
                          : isWin
                          ? styles.matchWin
                          : styles.matchLoss,
                      ]}
                      onPress={() =>
                        setExpandedMatchId(isExpanded ? null : m.id)
                      }
                    >
                      <View style={styles.matchTopRow}>
                        <Text
                          style={[
                            styles.outcomeBadge,
                            isDraw
                              ? styles.drawText
                              : isWin
                              ? styles.winText
                              : styles.lossText,
                          ]}
                        >
                          {isDraw ? 'EMPATE' : isWin ? 'VITÓRIA' : 'DERROTA'}
                          {m.status === 'abandoned' ? ' (W.O.)' : ''}
                        </Text>

                        <Text style={styles.matchMode}>
                          {m.is_ranked ? '⚔️ Ranqueada' : '🤝 Casual'} •{' '}
                          {formatDate(m.finished_at)}
                        </Text>
                      </View>

                      <View style={styles.matchMainRow}>
                        <Text style={styles.matchVs}>vs {oppName}</Text>
                        <Text style={styles.matchScore}>
                          {m.status === 'abandoned'
                            ? 'W.O.'
                            : `${myScore} × ${oppScore}`}
                        </Text>
                      </View>

                      <Text style={styles.tapHint}>
                        {isExpanded
                          ? '▲ Ocultar tabuleiro e jogadas'
                          : '▼ Ver tabuleiro final e turnos'}
                      </Text>

                      {/* Detalhes expandidos: Tabuleiro Final + Log de Turnos */}
                      {isExpanded && (
                        <View style={styles.detailsBox}>
                          <Text style={styles.detailsTitle}>Tabuleiro Final</Text>
                          <View style={styles.miniBoard}>
                            {m.board_state.map((cell, idx) => (
                              <View key={idx} style={styles.miniCell}>
                                {cell && (
                                  <CardView
                                    card={cell.card}
                                    owner={cell.owner}
                                    compact
                                  />
                                )}
                              </View>
                            ))}
                          </View>

                          {Array.isArray(m.turns_log) && m.turns_log.length > 0 && (
                            <View style={styles.turnsList}>
                              <Text style={styles.detailsTitle}>
                                Registro Turno a Turno
                              </Text>
                              {m.turns_log.map((t: any, i: number) => (
                                <Text key={i} style={styles.turnLogLine}>
                                  {t.event === 'INACTIVITY_TIMEOUT_3M'
                                    ? `• Turno ${t.turn}: ${
                                        t.player === 'BLUE' ? 'Azul' : 'Vermelho'
                                      } excedeu 3 min (W.O.)`
                                    : `• T${t.turn}: ${
                                        t.player === 'BLUE' ? 'Azul' : 'Vermelho'
                                      } jogou na casa ${Number(t.cell_index) + 1}${
                                        Array.isArray(t.flipped_indices) &&
                                        t.flipped_indices.length > 0
                                          ? ` (virou ${t.flipped_indices.length})`
                                          : ''
                                      }`}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    backgroundColor: '#1e293b',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#cbd5e1',
    fontWeight: '900',
    fontSize: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#60a5fa',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  listContent: {
    gap: 8,
    paddingBottom: 12,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 13,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rankRowMe: {
    borderColor: '#facc15',
    backgroundColor: '#1e293b',
  },
  rankPos: {
    color: '#facc15',
    fontSize: 16,
    fontWeight: '900',
    width: 34,
    textAlign: 'center',
  },
  rankName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  rankSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  rankElo: {
    color: '#facc15',
    fontSize: 14,
    fontWeight: '900',
  },
  matchCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    gap: 4,
  },
  matchWin: {
    borderLeftColor: '#22c55e',
  },
  matchLoss: {
    borderLeftColor: '#ef4444',
  },
  matchDraw: {
    borderLeftColor: '#94a3b8',
  },
  matchTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outcomeBadge: {
    fontSize: 11,
    fontWeight: '900',
  },
  winText: {
    color: '#4ade80',
  },
  lossText: {
    color: '#f87171',
  },
  drawText: {
    color: '#cbd5e1',
  },
  matchMode: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  matchMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchVs: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  matchScore: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  tapHint: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  detailsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  detailsTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  miniBoard: {
    width: 210,
    height: 210,
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    padding: 4,
    borderRadius: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  miniCell: {
    width: '31.5%',
    height: '31.5%',
    backgroundColor: '#1e293b',
    borderRadius: 6,
    padding: 1,
  },
  turnsList: {
    gap: 2,
  },
  turnLogLine: {
    color: '#94a3b8',
    fontSize: 11,
  },
});