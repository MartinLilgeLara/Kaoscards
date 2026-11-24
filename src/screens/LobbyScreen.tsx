import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PlayerColor, UserProfile } from '../types/game';

interface LobbyScreenProps {
  user: UserProfile;
  deckReady: boolean;
  waitingStatus: string | null;
  activeRoomCode: string | null;
  onOpenDeckBuilder: () => void;
  onFindQuickMatch: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onCancelWaiting: () => void;
  onStartLocalTest: () => void;
  onLogout: () => void;
}

export function LobbyScreen({
  user,
  deckReady,
  waitingStatus,
  activeRoomCode,
  onOpenDeckBuilder,
  onFindQuickMatch,
  onCreateRoom,
  onJoinRoom,
  onCancelWaiting,
  onStartLocalTest,
  onLogout,
}: LobbyScreenProps) {
  const [joinCode, setJoinCode] = useState('');

  if (waitingStatus) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.waitingTitle}>{waitingStatus}</Text>

        {activeRoomCode && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>CÓDIGO DA SALA</Text>
            <Text style={styles.codeValue}>{activeRoomCode}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.cancelButton} onPress={onCancelWaiting}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Perfil do Jogador */}
      <View style={styles.profileCard}>
        <View>
          <Text style={styles.usernameText}>@{user.username}</Text>
          <Text style={styles.eloText}>
            Ranking Elo: {user.elo_rating} • {user.role === 'mentor_admin' ? 'Mentor' : 'Aluno'}
          </Text>
        </View>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Baralho */}
      <TouchableOpacity style={styles.deckButton} onPress={onOpenDeckBuilder}>
        <Text style={styles.deckButtonTitle}>Biblioteca e Baralho</Text>
        <Text style={styles.deckButtonSub}>
          {deckReady ? 'Baralho de 5 cartas pronto ✓' : 'Configure suas 5 cartas'}
        </Text>
      </TouchableOpacity>

      {/* Fila Rápida */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Partida Online</Text>

        <TouchableOpacity
          style={[styles.primaryButton, !deckReady && styles.disabledButton]}
          disabled={!deckReady}
          onPress={onFindQuickMatch}
        >
          <Text style={styles.primaryButtonText}>Buscar Partida (Fila)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, !deckReady && styles.disabledButton]}
          disabled={!deckReady}
          onPress={onCreateRoom}
        >
          <Text style={styles.secondaryButtonText}>Criar Sala Privada</Text>
        </TouchableOpacity>

        <View style={styles.joinRow}>
          <TextInput
            style={styles.codeInput}
            placeholder="CÓDIGO"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            maxLength={4}
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <TouchableOpacity
            style={[
              styles.joinButton,
              (!deckReady || joinCode.trim().length < 4) && styles.disabledButton,
            ]}
            disabled={!deckReady || joinCode.trim().length < 4}
            onPress={() => onJoinRoom(joinCode.trim().toUpperCase())}
          >
            <Text style={styles.joinButtonText}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modo Local */}
      <TouchableOpacity style={styles.localButton} onPress={onStartLocalTest}>
        <Text style={styles.localButtonText}>
          Pass-and-Play Local (2 Jogadores no mesmo celular)
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  waitingTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  codeBox: {
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#facc15',
  },
  codeLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  codeValue: {
    color: '#facc15',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 28,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  cancelButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 44,
    paddingHorizontal: 18,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  usernameText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  eloText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  logoutText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 14,
  },
  deckButton: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  deckButtonTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  deckButtonSub: {
    color: '#60a5fa',
    fontSize: 13,
    marginTop: 3,
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  joinButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 22,
    justifyContent: 'center',
    borderRadius: 10,
  },
  joinButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.45,
  },
  localButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  localButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
