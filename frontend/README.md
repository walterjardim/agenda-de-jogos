# Agenda de Jogos — Frontend

Base em React Native, Expo SDK 57 e TypeScript estrito. A tela inicial é o login, inspirada em `../../MVP/wireframe/login-UX.png` e `wireframe-mvp.md`.

## Abrir no VS Code e executar

Pré-requisitos: Node.js 22.13 ou superior (recomendado: Node 22 LTS), npm e Expo Go compatível com SDK 57 para dispositivos físicos.

Abra esta pasta diretamente no VS Code: **Arquivo → Abrir Pasta → codigo-fonte/frontend**. No terminal:

```sh
npm ci
npm start
```

Leia o QR code com Expo Go; o celular e o computador devem estar na mesma rede. Se o Expo Go instalado não suportar o SDK, use uma development build compatível conforme a documentação oficial.

- `npm run web`: executar no navegador, sem emulador.
- `npm run android`: abrir em emulador Android já configurado no Android Studio.
- `npm run ios`: abrir no simulador iOS (somente macOS com Xcode).
- `npm run typecheck`: verificar TypeScript.
- `npm run build`: gerar os bundles Android/iOS e a versão web em `dist/`. Não produz APK/IPA.

## Builds instaláveis

O `eas.json` inclui perfis de desenvolvimento, APK para testes e produção. Para usar o perfil development, instale antes `expo-dev-client` com `npx expo install expo-dev-client`.

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
  (home)/                      # Buscar, Meus times e Perfil
src/features/auth/
  screens/LoginScreen.tsx       # Composição da tela e aviso de configuração
  components/                   # Marca, ilustração e botão Google
src/features/home/             # Telas e dados locais da prévia
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

## Escopo da autenticação

Esta entrega implementa a interface inicial. Ao pressionar **Entrar com Google**, a tela informa que a autenticação ainda precisa ser configurada; não cria conta, sessão nem simula login.

Para integrar, configurar os clientes OAuth Google por plataforma, implementar o fluxo apropriado em uma development build e enviar a identidade ao endpoint de autenticação da API REST definido na especificação técnica. O backend deve validar a identidade e criar sua própria sessão. Guardar o token da sessão mobile em Expo SecureStore. Nunca incluir segredo OAuth, credenciais de banco ou chaves privilegiadas no frontend. Acrescentar serviços e hooks em `features/auth` quando houver integração real, mantendo os componentes de apresentação independentes.

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
