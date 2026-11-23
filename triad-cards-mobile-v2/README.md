# Triad Cards Mobile (Protótipo Local 2 Jogadores)

Protótipo mobile em **React Native (Expo) + TypeScript** com arquitetura modular preparada para escalar para banco de dados (PostgreSQL/Supabase) e multiplayer online via WebSockets.

## Como Rodar

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor Expo (use `--tunnel` se estiver no GitHub Codespaces):
   ```bash
   npx expo start --tunnel
   ```

3. Abra o aplicativo **Expo Go** no seu celular e conecte pela URL `exp://...` ou QR Code.

## Como Gerar o APK de Teste

```bash
npx eas-cli build -p android --profile preview
```
