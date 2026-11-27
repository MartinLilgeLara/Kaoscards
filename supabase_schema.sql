-- ============================================================================
-- KAOS CARDS - SCHEMA ESTRUTURAL DO BANCO (POSTGRESQL / SUPABASE)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. USUÁRIOS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  elo_rating INT NOT NULL DEFAULT 1000,
  session_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_session_token ON public.users (session_token);

-- 2. CATÁLOGO DE CARTAS
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  north INT NOT NULL,
  east INT NOT NULL,
  south INT NOT NULL,
  west INT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'starter',
  blue_image_url TEXT,
  red_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INVENTÁRIO DOS JOGADORES
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON public.user_inventory (user_id);

-- 4. BARALHOS SALVOS (ATÉ 5 POR JOGADOR)
CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Baralho 1',
  card_ids UUID[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id ON public.decks (user_id);

-- 5. PARTIDAS ONLINE (RANQUEADAS E SALAS PRIVADAS)
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  is_ranked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'finished' | 'abandoned'
  blue_player_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  red_player_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blue_username TEXT NOT NULL DEFAULT 'Azul',
  red_username TEXT NOT NULL DEFAULT 'Vermelho',
  blue_deck_ids UUID[] NOT NULL DEFAULT '{}',
  red_deck_ids UUID[] NOT NULL DEFAULT '{}',
  current_turn TEXT NOT NULL DEFAULT 'BLUE', -- 'BLUE' | 'RED'
  turn_number INT NOT NULL DEFAULT 1,
  board_state JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null]'::jsonb,
  blue_used_indices INT[] NOT NULL DEFAULT '{}',
  red_used_indices INT[] NOT NULL DEFAULT '{}',
  winner TEXT, -- 'BLUE' | 'RED' | 'DRAW' | NULL
  turns_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  turn_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_players ON public.matches (blue_player_id, red_player_id);
CREATE INDEX IF NOT EXISTS idx_matches_room_code ON public.matches (room_code);

-- ============================================================================
-- REALTIME (ESCUTA DE SESSÃO ÚNICA E ATUALIZAÇÃO DE PARTIDAS)
-- ============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users, public.matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (LEITURA LIBERADA PARA O APP / ESCRITA APENAS VIA BACKEND)
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_users" ON public.users;
CREATE POLICY "allow_read_users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_read_cards" ON public.cards;
CREATE POLICY "allow_read_cards" ON public.cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_read_inventory" ON public.user_inventory;
CREATE POLICY "allow_read_inventory" ON public.user_inventory FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_read_decks" ON public.decks;
CREATE POLICY "allow_read_decks" ON public.decks FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_read_matches" ON public.matches;
CREATE POLICY "allow_read_matches" ON public.matches FOR SELECT USING (true);