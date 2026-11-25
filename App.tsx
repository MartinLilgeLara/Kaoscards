import React, { useEffect, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { supabase } from './src/lib/supabase';
import { SupabaseCardRepository } from './src/repositories/supabaseCardRepo';
import { AuthScreen } from './src/screens/AuthScreen';
import { DeckBuilderScreen } from './src/screens/DeckBuilderScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { LocalMatchScreen } from './src/screens/LocalMatchScreen';
import { MatchScreen } from './src/screens/MatchScreen';
import { CardData, MatchRecord, SavedDeck } from './src/types/game';

const STORAGE_KEY = 'kaos_cards_user_v1';
const repo = new SupabaseCardRepository();

function saveSession(userData: any | null, rememberMe = true) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    if (userData) {
      const target = rememberMe ? window.localStorage : window.sessionStorage;
      target.setItem(STORAGE_KEY, JSON.stringify({ user: userData, rememberMe }));
    }
  }
}

function loadSession(): { user: any; rememberMe: boolean } | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const rawLocal = window.localStorage.getItem(STORAGE_KEY);
      if (rawLocal) return JSON.parse(rawLocal);

      const rawSession = window.sessionStorage.getItem(STORAGE_KEY);
      if (rawSession) return JSON.parse(rawSession);
    } catch {
      return null;
    }
  }
  return null;
}

export default function App() {
  const { width } = useWindowDimensions();
  const initialSession = loadSession();

  const [user, setUser] = useState<any | null>(initialSession?.user ?? null);
  const [rememberMe, setRememberMe] = useState<boolean>(
    initialSession?.rememberMe ?? true
  );
  const [screen, setScreen] = useState<
    'AUTH' | 'LOBBY' | 'DECK_BUILDER' | 'MATCH' | 'LOCAL_MATCH'
  >(initialSession?.user ? 'LOBBY' : 'AUTH');

  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [equippedCards, setEquippedCards] = useState<CardData[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<MatchRecord | null>(null);
  const [localDecks, setLocalDecks] = useState<{
    blue: SavedDeck;
    red: SavedDeck;
  } | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const handleForceLogout = (message?: string) => {
    setUser(null);
    setSavedDecks([]);
    setEquippedCards([]);
    setMatchId(null);
    setActiveMatch(null);
    setLocalDecks(null);
    saveSession(null);
    setAuthNotice(message || null);
    setScreen('AUTH');
  };

  // Monitora login único: Realtime + checagem a cada 10s (substitui o useEffect anterior)
  useEffect(() => {
    if (!user?.id || !user?.session_token) return;

    const verifyToken = async () => {
      const stillValid = await repo.checkSession(user.session_token);
      if (!stillValid) {
        handleForceLogout(
          'Sessão encerrada: sua conta foi conectada em outro aparelho.'
        );
      }
    };

    const interval = setInterval(verifyToken, 10000);

    const userChannel = supabase
      .channel(`single_session_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          if (
            payload.new?.session_token &&
            payload.new.session_token !== user.session_token
          ) {
            handleForceLogout(
              'Sessão encerrada: sua conta foi conectada em outro aparelho.'
            );
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(userChannel);
    };
  }, [user?.id, user?.session_token]);

  // Sincroniza baralhos, cartas equipadas, sessão única e trava anti-quit no Lobby
  useEffect(() => {
    if (!user) return;

    async function syncLobbyState() {
      try {
        const isValidSession = await repo.checkSession(user.session_token);
        if (!isValidSession) {
          handleForceLogout(
            'Sessão encerrada: sua conta foi conectada em outro aparelho.'
          );
          return;
        }

        const [decks, profile, ongoing] = await Promise.all([
          repo.getUserDecks(user.id),
          repo.getUserProfile(user.id),
          repo.getActiveMatch(user.session_token),
        ]);

        setSavedDecks(decks);
        setActiveMatch(ongoing);

        const activeDeck = decks.find((d) => d.is_active) || decks[0];
        if (activeDeck && activeDeck.card_ids.length === 5) {
          const cards = await repo.getCardsByIds(activeDeck.card_ids);
          setEquippedCards(cards);
        } else {
          setEquippedCards([]);
        }

        if (profile.elo_rating !== user.elo_rating) {
          const updatedUser = { ...user, elo_rating: profile.elo_rating };
          setUser(updatedUser);
          saveSession(updatedUser, rememberMe);
        }

        if (ongoing && screen === 'LOBBY') {
          setMatchId(ongoing.id);
          setScreen('MATCH');
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (screen === 'LOBBY') {
      syncLobbyState();
    }
  }, [user?.id, screen]);

  const handleLoginSuccess = (loggedUser: any, shouldRemember: boolean) => {
    setAuthNotice(null);
    setUser(loggedUser);
    setRememberMe(shouldRemember);
    saveSession(loggedUser, shouldRemember);
    setScreen('LOBBY');
  };

  const isWideScreen = width > 540;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#020617',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 520,
          backgroundColor: '#0f172a',
          borderLeftWidth: isWideScreen ? 1 : 0,
          borderRightWidth: isWideScreen ? 1 : 0,
          borderColor: '#1e293b',
        }}
      >
        {!user || screen === 'AUTH' ? (
          <AuthScreen
            onAuthSuccess={handleLoginSuccess}
            notice={authNotice}
          />
        ) : screen === 'DECK_BUILDER' ? (
          <DeckBuilderScreen
            userId={user.id}
            sessionToken={user.session_token}
            repo={repo}
            onDeckSaved={() => setScreen('LOBBY')}
            onBack={() => setScreen('LOBBY')}
          />
        ) : screen === 'LOCAL_MATCH' && localDecks ? (
          <LocalMatchScreen
            blueDeck={localDecks.blue}
            redDeck={localDecks.red}
            repo={repo}
            onExit={() => {
              setLocalDecks(null);
              setScreen('LOBBY');
            }}
          />
        ) : screen === 'MATCH' && matchId ? (
          <MatchScreen
            matchId={matchId}
            user={user}
            repo={repo}
            onExitMatch={() => {
              setMatchId(null);
              setScreen('LOBBY');
            }}
          />
        ) : (
          <LobbyScreen
            user={user}
            savedDecks={savedDecks}
            equippedCards={equippedCards}
            activeMatch={activeMatch}
            repo={repo}
            onMatchReady={(id) => {
              setMatchId(id);
              setScreen('MATCH');
            }}
            onStartLocalMatch={(blueDeck, redDeck) => {
              setLocalDecks({ blue: blueDeck, red: redDeck });
              setScreen('LOCAL_MATCH');
            }}
            onOpenDeckBuilder={() => setScreen('DECK_BUILDER')}
            onLogout={() => handleForceLogout()}
          />
        )}
      </View>
    </View>
  );
}