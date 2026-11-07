# Agenda de Jogos — Frontend

Base em React Native, Expo SDK 57 e TypeScript estrito. A tela inicial é o login, inspirada em `../../MVP/wireframe/login-UX.png` e `wireframe-mvp.md`.

## Executar

Use Node.js 24, instale as dependências e copie o arquivo de ambiente na pasta
`frontend`.

```powershell
npm ci
Copy-Item .env.example .env
```

Preencha `EXPO_PUBLIC_API_URL` com a URL da API incluindo `/api/v1`. Para o
navegador local, use `http://localhost:3000/api/v1`. No dispositivo, a URL
precisa ser acessível a partir do dispositivo. Builds de produção exigem HTTPS.

Configure os clientes OAuth no mesmo projeto do Google Cloud.

- **Web:** configure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` com o ID do cliente
  OAuth do tipo Web. Autorize a origem JavaScript do frontend no Google Cloud,
  por exemplo `http://localhost:8081`. Autorize essa mesma origem em
  `CORS_ORIGINS` no backend. Rode `npm run web`.
- **Android:** registre o pacote `com.agendadejogos.app` e o SHA-1 da chave que
  assina o build no cliente OAuth Android. O SDK recebe o ID do cliente Web
  para solicitar o token de identidade.
- **iOS:** registre o bundle ID `com.agendadejogos.app` e preencha
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. A configuração do Expo deriva o esquema
  de retorno a partir desse ID. Recompile o app após mudar esse valor.

No backend, inclua o ID Web e qualquer audiência iOS usada pelo app em
`GOOGLE_CLIENT_IDS`. Use apenas IDs públicos no frontend. O login nativo requer
um build de desenvolvimento ou distribuição. Para compilar localmente, use
`npx expo run:android` ou `npx expo run:ios` no macOS. Para abrir o servidor
de desenvolvimento com um build já instalado, use `npm start`.

- `npm run typecheck` verifica os tipos.
- `npm run lint` executa a análise estática.
- `npm run build` exporta os bundles Android, iOS e web em `dist/`.

## Builds instaláveis

O `eas.json` inclui perfis de desenvolvimento, APK para testes e produção. Configure as variáveis públicas para o ambiente de build no EAS.

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile production
```

Os builds remotos exigem conta Expo, rede e configuração de assinatura. A distribuição iOS exige credenciais Apple apropriadas. Confirme os identificadores `com.agendadejogos.app` antes de publicar. Nenhum build remoto foi solicitado por esta implementação.

## Organização

```text
src/app/                        # Rotas do Expo Router
  (home)/                      # Agenda, Buscar, Meus times e Perfil
src/features/auth/
  screens/LoginScreen.tsx       # Login com Google
  components/                   # Marca, ilustração e botão Google
src/features/home/             # Telas autenticadas e prévia local
src/shared/
  components/CalendarIcon.tsx    # Ícone reutilizável
  theme/theme.ts                # Paleta centralizada
```

Componentes funcionais, propriedades tipadas, estilos locais e separação por funcionalidade. Layout com áreas seguras, largura máxima, rolagem para telas pequenas e suporte à escala de fonte do sistema. Ilustrações SVG locais funcionam offline.

## Prévia da home

Em desenvolvimento, abra **Prévia da home** na tela inicial. Use **Buscar** para
encontrar e seguir o Ajax. Em **Meus times**, é possível deixar de seguir. Em
**Perfil**, use **Sair da prévia** para voltar ao login. Os dados são locais e o
seguimento é descartado ao sair. O acesso à prévia fica restrito a desenvolvimento.

## Sessão e perfil

O login envia o ID token para `POST /auth/google`. O app guarda a sessão emitida
pela API no SecureStore em Android e iOS. Na web, usa o armazenamento da aba,
que mantém a sessão ao recarregar a página e é descartado ao fechar a aba.
Ao restaurar a sessão, o app consulta `GET /me`. O perfil salva o fuso em
`PATCH /me`, e **Sair** revoga a sessão em `POST /auth/logout`.

O app abre **Buscar times** quando a conta ainda não tem time selecionado e
**Agenda da semana** quando o perfil já tem um time. A busca, a escolha de
times e a listagem de jogos da conta dependem dos respectivos endpoints.
O Ajax de exemplo aparece na prévia de desenvolvimento.

## Referências

- [Documentação Expo](https://docs.expo.dev/)
- [TypeScript no Expo](https://docs.expo.dev/guides/typescript/)
- [Builds com EAS](https://docs.expo.dev/build/introduction/)

## Validação desta entrega

TypeScript e exportação de bundles Android, iOS e web verificados. A compilação nativa de APK/IPA e a execução em aparelho físico ainda precisam ser verificadas no ambiente de distribuição.

A auditoria npm identificou 23 avisos em dependências transitivas da cadeia Expo/React Native (7 moderados e 16 altos). As correções sugeridas incluem voltar a versões antigas e incompatíveis do SDK; por isso não foi aplicado `npm audit fix --force`. Reavaliar a auditoria e as atualizações do SDK antes da distribuição.

## npm no PowerShell deste computador

Foi identificado um problema preexistente no comando global npm: ele aponta para uma instalação incompleta em AppData/Roaming. Sem alterar a configuração do computador, o script local permite executar o npm que acompanha o Node.js:

```powershell
.\npm-local.ps1 ci
.\npm-local.ps1 start
.\npm-local.ps1 run web
.\npm-local.ps1 run lint
.\npm-local.ps1 run typecheck
.\npm-local.ps1 run build
```

Em instalações normais, os comandos npm habituais continuam funcionando. Se a política local bloquear scripts PowerShell, use diretamente `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run web`.

A análise estática usa `npm run lint`; a formatação usa `npm run format` e `npm run format:check`.
