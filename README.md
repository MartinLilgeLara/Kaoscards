# Kaos Cards Online (React Native + Expo + Supabase)

Projeto completo com autenticação via hash `bcrypt` no PostgreSQL, biblioteca de cartas, construtor de baralhos (5 cartas), matchmaking (fila rápida e sala por código) e partidas em tempo real via Supabase Realtime.

## 1. Configurar a Chave do Supabase

Abra o arquivo `src/lib/supabase.ts` e cole a sua **Publishable key** (`sb_publishable_...`) na constante `SUPABASE_PUBLISHABLE_KEY`. A URL do projeto (`https://auzducmbonumgyvevlqi.supabase.co`) já está configurada.

## 2. Instalar e Rodar no Codespaces

```bash
npm install
npx expo start --tunnel
```

Abra o aplicativo **Expo Go** no celular e escaneie o QR Code ou cole o link `exp://...`.

## 3. Gerar APK Instalável

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```
