-- Referência completa do banco de dados no Supabase (SQL Editor)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  elo_rating INT NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  north INT NOT NULL,
  east INT NOT NULL,
  south INT NOT NULL,
  west INT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  card_ids UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION register_user(p_username TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user users;
  v_starter_ids UUID[];
BEGIN
  IF length(trim(p_username)) < 3 OR length(p_password) < 4 THEN
    RAISE EXCEPTION 'Usuário deve ter 3+ letras e senha 4+ caracteres.';
  END IF;

  INSERT INTO users (username, password_hash)
  VALUES (lower(trim(p_username)), crypt(p_password, gen_salt('bf')))
  RETURNING * INTO v_user;

  WITH picked AS (
    INSERT INTO user_inventory (user_id, card_id)
    SELECT v_user.id, id FROM cards ORDER BY random() LIMIT 5
    RETURNING card_id
  )
  SELECT array_agg(card_id) INTO v_starter_ids FROM picked;

  INSERT INTO decks (user_id, card_ids)
  VALUES (v_user.id, v_starter_ids);

  RETURN json_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role', v_user.role,
    'elo_rating', v_user.elo_rating
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este nome de usuário já está em uso.';
END;
$$;

CREATE OR REPLACE FUNCTION login_user(p_username TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user users;
BEGIN
  SELECT * INTO v_user
  FROM users
  WHERE username = lower(trim(p_username))
    AND password_hash = crypt(p_password, password_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário ou senha inválidos.';
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role', v_user.role,
    'elo_rating', v_user.elo_rating
  );
END;
$$;
