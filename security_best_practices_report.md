# Revisão de segurança do Agenda de Jogos

**Resumo executivo.** A primeira correção é separar a permissão de seguir um time das permissões de gerenciar a agenda e consultar dados restritos do elenco. Hoje, seguir é uma ação autônoma que também concede acesso de escrita. A segunda frente é proteger a sessão web e limitar o consumo de recursos da API.

## Prioridade alta

### 01 — Seguir um time concede permissões de edição e exclusão

- **Evidência.** A busca lista times para contas autenticadas. A ação de seguir cria o vínculo sem aprovação do dono. A API usa o mesmo critério de criador ou seguidor para leitura e para criar, editar e excluir jogos, além de substituir convocações. A colaboração ampla é uma regra documentada do produto. [Busca](backend/src/teams/routes.ts#L124) · [Vínculo](backend/src/teams/routes.ts#L173) · [Permissões de jogos e convocações](backend/src/matches/routes.ts#L337) · [Regra documentada](backend/README.md#L177)
- **Impacto.** Uma conta autenticada pode adquirir permissões de escrita em uma agenda de outra equipe sem delegação do responsável. A edição afeta toda a equipe e a exclusão remove a partida compartilhada.
- **Correção.** Dê aos seguidores somente a leitura autorizada e reserve mudanças ao criador e a editores convidados. Aplique a matriz de permissões na API, na mesma transação da escrita, e derive os botões dessas permissões. Cubra criador, editor, seguidor e usuário sem vínculo nos testes. Caso a colaboração aberta seja intencional, torne-a uma escolha explícita do responsável pelo time e mantenha a exclusão restrita. [OWASP ASVS — autorização](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x17-V8-Authorization.md)

### 02 — Dados do elenco disponíveis por vínculo sem aprovação

- **Evidência.** A listagem de atletas retorna nome, número, posição e status para seguidores. A ficha e as mensagens de convocação também expõem nomes de pessoas selecionadas. A disponibilidade de equipes privadas e a autorização para leitura desses campos não são diferenciadas por papel nas rotas revisadas. [Elenco](backend/src/athletes/routes.ts#L76) · [Campos retornados](backend/src/athletes/routes.ts#L30) · [Ficha e mensagens](backend/src/matches/routes.ts#L308)
- **Impacto.** Uma conta sem relação com a equipe pode obter dados identificáveis do elenco e informações de disponibilidade, inclusive status de lesão. Isso merece atenção especial se o app transportar dados de categorias infantis.
- **Correção.** Defina quais campos podem ser públicos. Restrinja status de lesão e outros dados detalhados do elenco aos papéis que precisam deles. Para times privados ou categorias infantis, exija convite ou aprovação antes de liberar elenco e convocações e aplique a regra também às mensagens de compartilhamento. [OWASP — controle de acesso por recurso e campo](https://devguide.owasp.org/en/04-design/02-web-app-checklist/07-access-controls/)

### 03 — Dependência do roteamento afetada por avisos de disponibilidade

- **Evidência.** O lockfile contém Expo Router 57.0.24, que usa `query-string` 7.1.3 e `decode-uri-component` 0.2.2. Confirmei na dependência instalada que o roteador analisa parâmetros de rota com `query-string`. O registro npm aponta dois avisos de severidade alta para o decodificador. [Expo Router](frontend/package-lock.json#L5629) · [Decodificador](frontend/package-lock.json#L4387) · [CVE-2026-45822](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) · [CVE-2026-118664](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)
- **Impacto.** A dependência pode bloquear o processamento de navegação quando recebe entradas problemáticas. A versão está confirmada no projeto. O impacto em cada plataforma ainda precisa ser validado após a atualização.
- **Correção.** Atualize a cadeia do roteamento para uma versão corrigida e compatível com o SDK do Expo. Valide links profundos, login, navegação e exportação nas plataformas suportadas. O npm sugere uma mudança de versão principal, por isso teste a compatibilidade antes de atualizar o lockfile.

## Prioridade média

### 04 — A sessão web fica legível para JavaScript

- **Evidência.** O login grava o token bearer em `window.sessionStorage`. A validade padrão da sessão no servidor é de 168 horas, ajustável por configuração. No app nativo, o armazenamento já usa SecureStore. [Gravação do token](frontend/src/features/auth/AuthContext.tsx#L142) · [Armazenamento web](frontend/src/features/auth/sessionStorage.web.ts#L1) · [Validade](backend/src/config.ts#L33) · [SecureStore](frontend/src/features/auth/sessionStorage.ts#L1)
- **Impacto.** Se código indevido for executado na origem web, poderá ler o token e reutilizá-lo até expiração ou revogação. A revisão identificou a exposição do token ao JavaScript, sem confirmar uma falha de injeção de script.
- **Correção.** Migre a sessão web, se publicado, para cookie `HttpOnly` e `Secure` por uma API de mesma origem ou camada intermediária. Configure `SameSite` conforme a arquitetura e proteja as escritas contra CSRF. Como mitigação, reduza a validade web e verifique a política CSP do ambiente. Preserve SecureStore e bearer no nativo. [OWASP — gerenciamento de sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### 05 — Limites de frequência só aparecem no login

- **Evidência.** O limitador Fastify tem `global: false`. Só a rota Google define um limite. A busca, a criação de jogos e a substituição de convocações executam trabalho no banco e não têm limites de frequência no código. Existem validação de entrada, paginação e limite de corpo. Uma proteção adicional no gateway não foi verificada. [Fastify](backend/src/app.ts#L22) · [Login](backend/src/auth/routes.ts#L48) · [Busca](backend/src/teams/routes.ts#L124) · [Convocações](backend/src/matches/routes.ts#L390)
- **Impacto.** Tráfego autenticado excessivo pode sobrecarregar o banco ou disputar bloqueios da equipe, reduzindo a disponibilidade para usuários legítimos.
- **Correção.** Aplique limites por conta e por operação, com um limite inicial conservador no perímetro para tráfego não autenticado. Em múltiplas instâncias, use um contador compartilhado ou limites no gateway. Garanta resposta 429 e monitore volume e latência. [OWASP API4 — consumo de recursos](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)

## Prioridade baixa e verificação de produção

### 06 — O cliente abre a URL de compartilhamento retornada pela API sem validar o destino

- **Evidência.** O servidor constrói uma URL HTTPS para `wa.me`, mas o cliente abre o valor recebido diretamente. [Geração no servidor](backend/src/matches/message.ts#L127) · [Abertura no cliente](frontend/src/features/matches/screens/ShareMatchScreen.tsx#L52)
- **Impacto.** Se a resposta for alterada por um serviço intermediário ou uma versão futura da API, o app pode direcionar a pessoa a um destino diferente do WhatsApp. O gerador revisado usa um destino fixo.
- **Correção.** Gere o link no cliente a partir do texto e de uma origem fixa ou aceite somente `https://wa.me` com o caminho esperado. Para valores inválidos, mantenha a opção de copiar.

### 07 — As ações do build são referenciadas por tags mutáveis

- **Evidência.** O workflow do APK usa tags de versão para checkout, setup de Node e Java e publicação do artefato. O job usa permissões de repositório de leitura. [Workflow](.github/workflows/gerar-apk.yml#L14)
- **Impacto.** Uma alteração em uma tag usada pelo workflow pode mudar o código executado no build de distribuição.
- **Correção.** Fixe cada Action pelo SHA completo da versão homologada e automatize a revisão de atualizações.

### 08 — Dependências de build e migração também têm avisos

- **Evidência.** O `npm audit --omit=dev` de 22/11/2026 marcou seis entradas na árvore do frontend e três na do backend. Os totais incluem pacotes afetados indiretamente. Além do roteamento, o npm apontou `minimatch` na cadeia do Expo Fingerprint e `effect` na cadeia do Prisma. Neste repositório, as cadeias identificadas estão associadas a ferramentas. A exposição desses avisos por uma rota pública da API não foi estabelecida. [Expo Fingerprint](frontend/package-lock.json#L1589) · [Prisma Config](backend/package-lock.json#L756) · [Aviso do minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) · [Aviso do Effect](https://github.com/advisories/GHSA-7589-6fvf-x4pw)
- **Correção.** Atualize as ferramentas em conjunto com as versões suportadas do Expo e do Prisma. Verifique geração do cliente, migrações em banco descartável e build do APK. Evite aplicar automaticamente os downgrades de versão principal sugeridos para eliminar os alertas.

**Produção.** Verifique CSP na hospedagem web, com as origens necessárias ao Google Identity, e os limites do gateway. O repositório mostra o carregamento do script oficial de login, mas não determina quais cabeçalhos a infraestrutura entrega. [Login web](frontend/src/features/auth/components/GoogleLogin.web.tsx#L33)

## Escopo

Revisão estática do frontend TypeScript/Expo/React Native, da variante web, da API Fastify/Prisma e do workflow de APK. A referência da skill para React foi aplicada à web e os controles do Fastify foram revisados diretamente no código. Foram observados tokens aleatórios de 32 bytes com hash no banco, validação do token Google, CORS por origens explícitas e `Cache-Control: no-store` nas rotas revisadas. A infraestrutura publicada e os dados de produção ficaram fora do escopo. [Sessões](backend/src/auth/service.ts#L24) · [Google](backend/src/auth/google.ts#L14) · [CORS](backend/src/app.ts#L29) · [Cache](backend/src/auth/routes.ts#L41)
