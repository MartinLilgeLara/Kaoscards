import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { GameState, PlayerColor, UserProfile } from '../types/game';

export interface GuestJoinPayload {
  username: string;
  deckIds: string[];
}

export class RoomService {
  static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  static connectToRoom(params: {
    roomCode: string;
    role: PlayerColor;
    user: UserProfile;
    deckIds: string[];
    onGuestJoined?: (payload: GuestJoinPayload) => void;
    onStateSync: (state: GameState) => void;
  }): RealtimeChannel {
    const { roomCode, role, user, deckIds, onGuestJoined, onStateSync } = params;
    const channel = supabase.channel(`room:${roomCode.toUpperCase()}`, {
      config: { broadcast: { self: false } },
    });

    let retryInterval: ReturnType<typeof setInterval> | null = null;
    let matchStarted = false;

    channel
      .on('broadcast', { event: 'guest_joined' }, ({ payload }) => {
        if (role === 'BLUE' && onGuestJoined) {
          onGuestJoined(payload as GuestJoinPayload);
        }
      })
      .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        matchStarted = true;
        if (retryInterval) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
        onStateSync(payload.gameState as GameState);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && role === 'RED') {
          const announceJoin = () => {
            if (matchStarted) return;
            channel.send({
              type: 'broadcast',
              event: 'guest_joined',
              payload: { username: user.username, deckIds },
            });
          };

          announceJoin();
          retryInterval = setInterval(announceJoin, 1800);
        }
      });

    return channel;
  }

  static async broadcastState(
    channel: RealtimeChannel,
    gameState: GameState
  ): Promise<void> {
    await channel.send({
      type: 'broadcast',
      event: 'sync_state',
      payload: { gameState },
    });
  }

  // Fila pública rápida usando Realtime Presence
  static joinQuickQueue(params: {
    user: UserProfile;
    onMatchFound: (roomCode: string, assignedRole: PlayerColor) => void;
  }): RealtimeChannel {
    const { user, onMatchFound } = params;
    let matched = false;

    const queueChannel = supabase.channel('lobby:quick_queue', {
      config: {
        presence: { key: user.id },
        broadcast: { self: false },
      },
    });

    queueChannel
      .on('broadcast', { event: 'match_paired' }, ({ payload }) => {
        if (matched) return;
        if (payload.guestId === user.id) {
          matched = true;
          onMatchFound(payload.roomCode, 'RED');
        }
      })
      .on('presence', { event: 'sync' }, () => {
        if (matched) return;
        const state = queueChannel.presenceState();
        const playerIds = Object.keys(state).sort();

        if (playerIds.length >= 2 && playerIds[0] === user.id) {
          const opponentId = playerIds[1];
          const roomCode = RoomService.generateRoomCode();
          matched = true;

          queueChannel.send({
            type: 'broadcast',
            event: 'match_paired',
            payload: {
              hostId: user.id,
              guestId: opponentId,
              roomCode,
            },
          });

          onMatchFound(roomCode, 'BLUE');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await queueChannel.track({
            userId: user.id,
            username: user.username,
            joinedAt: Date.now(),
          });
        }
      });

    return queueChannel;
  }
}
