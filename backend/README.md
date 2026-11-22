# Agenda de Jogos — Backend

API REST em Node.js, TypeScript, Fastify e Prisma com PostgreSQL. Esta etapa
inclui login Google, sessões da API, perfil e preferência do time da agenda.
A gestão de equipes permite cadastrar, listar, editar e excluir times do usuário autenticado.

## Executar

Use Node.js 24 LTS e um banco PostgreSQL. Na pasta `backend`:

```powershell
npm ci
Copy-Item .env.example .env
```

Se apenas o pnpm estiver disponível, substitua `npm` por
`pnpm --package=npm@11 dlx npm` nos comandos abaixo e no `npm ci` acima.

Preencha `DATABASE_URL` e `GOOGLE_CLIENT_IDS` no `.env`. A lista de IDs deve
corresponder à audiência dos tokens de identidade obtidos pelo aplicativo.
Quando houver mais de um cliente autorizado, separe os IDs por vírgula.
A validação usa as chaves públicas do Google.

No Supabase, `DATABASE_URL` é a conexão da API. Use `DIRECT_URL` para migrations
se a API usar o pooler em modo transação. A URL de migrations deve usar a conexão
direta ou o pooler em modo sessão. A migration habilita RLS sem políticas para
clientes. A conexão SQL do backend deve usar a role proprietária das tabelas.

```powershell
npm run db:migrate
npm run db:generate
npm run dev
```

Para o frontend web, configure `CORS_ORIGINS` com as origens autorizadas,
separadas por vírgula, como `http://localhost:8081`. As requisições web usam o
cabeçalho `Authorization`. Sem essa configuração, a API fica disponível para
clientes nativos e para chamadas web na mesma origem.

A API escuta em `127.0.0.1:3000` por padrão. Em produção, execute
`npm run build` e `npm start` e exponha a API por HTTPS. Quando houver um proxy,
configure a confiança no proxy conforme a topologia antes de usar o limite de
tentativas por IP em produção.

## Rotas

| Método e rota              | Entrada                                          | Resultado                                                     |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `POST /api/v1/auth/google` | JSON com `idToken` do Google                     | Perfil, `sessionToken` opaco e `expiresAt` em UTC             |
| `GET /api/v1/me`           | Bearer da sessão                                 | Perfil com `id`, `name`, `email`, `timezone` e `activeTeamId` |
| `PATCH /api/v1/me`         | Bearer e JSON com `timezone` e/ou `activeTeamId` | Perfil atualizado                                             |
| `POST /api/v1/auth/logout` | Bearer da sessão                                 | `204` e revogação da sessão usada na requisição               |

O login identifica o usuário pelo `sub` do Google, limita tentativas por IP e
exige e-mail verificado. Se o token vier sem nome, o perfil usa o e-mail como
nome. A sessão da API dura sete dias por padrão, com duração configurável em
`SESSION_TTL_HOURS` de 1 a 720 horas. Envie-a como
`Authorization: Bearer <sessionToken>`. O banco guarda somente o hash da sessão.

O fuso inicial é `America/Sao_Paulo`. O time inicial é nulo. Para selecionar um
time, o usuário precisa ser o criador ou seguidor. Novo login preserva ambas as
preferências. A exclusão da equipe limpa a seleção.

## Verificação

### Gestão de equipes

Todas as rotas exigem `Authorization: Bearer <sessionToken>`:

| Método e rota | Entrada | Resultado |
| --- | --- | --- |
| `GET /api/v1/me/teams` | Sessão | Lista das equipes criadas pelo usuário, ordenada por nome |
| `POST /api/v1/teams` | `name`, `sport`, `category` | `201` com a equipe salva |
| `PATCH /api/v1/teams/:id` | Um ou mais dos campos do cadastro | Equipe atualizada |
| `DELETE /api/v1/teams/:id` | ID UUID | `204` |

Os campos são obrigatórios no cadastro, têm espaços nas extremidades removidos
e aceitam até 100 caracteres no nome e 60 na modalidade e categoria. O dono é
sempre obtido da sessão; não pode ser informado pelo cliente. Edição e exclusão
de equipe inexistente ou de outro usuário retornam `404`. A exclusão remove
seguidores e limpa o time ativo por meio das relações já existentes no banco.
Não é necessária uma nova migration para esta funcionalidade.

Após o login, **Meus times** reúne equipes próprias e seguidas, sem duplicados.
A edição e exclusão são oferecidas ao criador. A lista mostra o vínculo,
a quantidade de atletas e permite escolher o time ativo ou deixar de seguir.

### Busca, seguimento e seleção persistente

| Método e rota | Resultado |
| --- | --- |
| `GET /api/v1/teams` | Lista paginada de times próprios e seguidos com `isOwner`, `isFollowing`, `athletesCount` e `nextMatchAt` |
| `GET /api/v1/teams/search?q=ajax` | Busca por nome, com metadados de descoberta e os vínculos do usuário |
| `PUT /api/v1/teams/:id/follow` | Segue o time e retorna `{ teamId, isFollowing: true }` |
| `DELETE /api/v1/teams/:id/follow` | Deixa de seguir, com resposta `204` |
| `GET /api/v1/teams/:id` | Dados da equipe para criador ou seguidor |
| `PATCH /api/v1/me` | Salva `activeTeamId` de um time próprio ou seguido |
| `POST /api/v1/teams/:id/select` | Compatibilidade com a seleção anterior, também exige vínculo atual |

Todas as rotas exigem sessão. Seguir e deixar de seguir são idempotentes,
sem corpo de requisição; o usuário vem da sessão. Time inexistente retorna
`404`. Seguir concede acesso imediato e preserva a escolha atual da agenda.
Deixar de seguir remove somente o próprio vínculo. A transação bloqueia a
mesma linha da equipe usada nas mutações de jogos, convocações e seleção.

Para seguidores, deixar de seguir revoga o acesso e limpa `activeTeamId`
apenas se apontar para esse time. Jogos e outros cadastros são preservados.
O criador pode seguir e deixar de seguir o próprio time, mantendo acesso e
seleção pela propriedade. A exclusão de equipe continua limpando a seleção
pela chave estrangeira.

A busca recebe `q` com 2 a 80 caracteres, ordena por nome e ID e aceita
`limit` de 1 a 50 e cursor opaco. Retorna somente `id`, `name`, `sport`,
`category`, `isOwner` e `isFollowing`. A listagem `/teams` mantém filtro
opcional `q`, `limit` de 1 a 50 (padrão 20) e cursor UUID crescente.
O parâmetro explícito `mine=false` mantém a descoberta da versão anterior;
`mine=true` é o padrão. `/me/teams` mantém a lista antiga de equipes próprias.

O app oferece **Seguir** na busca e **Escolher time** após criar o vínculo
ou para uma equipe própria. **Meus times** confirma a ação de deixar de
seguir. A seleção é salva por `PATCH /me`, preservada no login e restaurada
na inicialização. Ao detectar `404` por perda de acesso, o app atualiza o
perfil e volta à escolha quando o time ativo tiver sido limpo.

### Gestão do elenco

| Método e rota | Entrada | Resultado |
| --- | --- | --- |
| `GET /api/v1/teams/:teamId/athletes` | `q`, `status`, `limit` (1 a 50) e `cursor` opaco, opcionais | `{ data, nextCursor }` em ordem de camisa |
| `POST /api/v1/teams/:teamId/athletes` | `name`, `position`, `shirtNumber` e `status` opcional | `201` com o atleta e seu `teamId` |
| `PATCH /api/v1/athletes/:id` | Um ou mais campos do cadastro | Atleta atualizado |
| `DELETE /api/v1/athletes/:id` | ID do atleta | `204` |

Somente o criador pode consultar e gerenciar o elenco. A consulta por seguidores
retorna `404` e tentativas de alterar o elenco retornam `403`.
Recursos inexistentes ou de equipes sem vínculo retornam `404`. A camisa é
um inteiro de 0 a 999 e precisa ser única no time. Números em uso retornam
`409 CONFLICT`. O nome aceita de 1 a 80 caracteres, a posição é obrigatória
e o status é `active` (padrão), `injured` ou `suspended`. O filtro `q`
busca por trecho do nome sem diferenciar maiúsculas de minúsculas.

Aplique a migration de elenco com `npm run db:migrate` antes de iniciar a
API com o novo código.

### Gestão de competições

Conforme a seção 4.5 do MVP, cada competição pertence a um time e recebe
somente `name` (1 a 120 caracteres). Campos financeiros são rejeitados.

| Método e rota | Resultado |
| --- | --- |
| `GET /api/v1/teams/:teamId/competitions?limit=50&cursor=<opaco>` | `{ data, nextCursor }`, com `id`, `teamId` e `name` |
| `POST /api/v1/teams/:teamId/competitions` | `201` com a competição |
| `PATCH /api/v1/competitions/:id` | `200` com a competição renomeada |
| `DELETE /api/v1/competitions/:id` | `204` |

Todas exigem sessão. Criadores gerenciam os cadastros e seguidores podem
consultá-los. Alterações por seguidores retornam `403 FORBIDDEN`; recursos
inexistentes ou de times sem vínculo retornam `404 NOT_FOUND`.
A paginação usa UUID crescente codificado em base64url e continua válida
quando a competição do cursor é excluída. A tela apresenta os nomes em
ordem alfabética e recarrega ao retornar do cadastro.

Execute `npm run db:migrate` para aplicar a migration de competições.
A exclusão de uma competição limpa `matches.competition_id` e preserva a
taxa dos jogos.

### Jogos na agenda

`GET /api/v1/teams/:teamId/matches?from=2026-11-19&to=2026-11-19` lista
os jogos de um dia inteiro. O mesmo endpoint recebe o intervalo de segunda a
domingo para a Home. As datas são inclusivas no fuso do perfil. O resultado
vem em ordem de início e ID, com limite de até 50 registros e resposta
`{ data, nextCursor }`. Use `upcoming=true` apenas para filtrar jogos
que ainda não começaram.

Criadores e seguidores podem listar e consultar jogos do time. Somente o
criador pode cadastrar, editar e excluir jogos. Para abrir a ficha, use `GET /api/v1/matches/:id`.
`arrivalAt` é sempre calculado como uma hora antes de `startsAt`.
Execute `npm run db:migrate` no ambiente do backend para habilitar as
rotas com a tabela de jogos.

### Salvamento de convocações

`PUT /api/v1/matches/:id/callups` recebe `{ "athleteIds": ["<UUID>"] }`
com a lista completa de convocados e exige sessão do criador da equipe.
A resposta inclui `matchId`, `hasSavedCallup`, `callups` em ordem
de camisa, `count`, `warnings` e `estimatedRefereeTotalCents`.

A lista vazia é válida e salva `hasSavedCallup: true`. O detalhe do jogo
retorna esse indicador para restaurar a seleção, inclusive vazia. Repetir a
requisição mantém a mesma seleção. Atletas lesionados ou suspensos são aceitos
com aviso. Taxa não informada retorna total nulo; taxa zero retorna zero.

Campos desconhecidos e IDs duplicados retornam `400`. Atletas inexistentes ou
sem acesso retornam `404`; atletas de outra equipe acessível retornam `422`.
A substituição ocorre em transação com bloqueio da equipe, do jogo e proteção
das referências do elenco. Uma falha preserva a convocação anterior.
As tabelas e o indicador usam a migration existente de jogos.

### Ficha e convocação para compartilhar

`GET /api/v1/matches/:id/message?type=sheet` gera a ficha do jogo.
`type=callup` gera a convocação e é o padrão quando o parâmetro é omitido.
Criador e seguidores podem consultar a ficha de compartilhamento. A
convocação com nomes é exclusiva do criador. A resposta contém `type`, `text` e
`whatsappUrl`. A convocação exige ao menos um atleta e retorna `422` quando
vazia; a ficha pode ser gerada sem convocados.

O texto usa os dados atuais do time, competição, peças e atletas, ordenados
por número de camisa. Início e chegada são formatados em português no fuso
atual do perfil, com chegada uma hora antes. Observações mantêm as quebras de
linha. Taxa nula é omitida e taxa zero aparece como R$ 0,00 por atleta.

Até 2.000 caracteres, o link do WhatsApp codifica o texto completo. Acima
disso, `whatsappUrl` é nulo e `text` permanece integral para compartilhamento
nativo ou cópia. O app exibe e copia esse mesmo texto e usa o link da API.

### Comandos

```powershell
npm run build
npm test
```

Os testes usam JWTs assinados localmente e fornecem uma chave pública de teste
à biblioteca do Google. Para executar também os testes de persistência,
configure `TEST_DATABASE_URL` com um PostgreSQL **de teste** que já recebeu a
migration. Os testes de persistência criam e removem seus próprios registros.

### Sessões web e proteção da API

Para persistir a sessão web, sirva a API e o site na mesma origem HTTPS.
Defina `WEB_SESSION_ORIGIN` no backend com essa origem, sem barra final,
e compile o frontend com `EXPO_PUBLIC_WEB_COOKIE_SESSION=true`. O cookie
é restrito ao host, usa `Secure`, `HttpOnly` e `SameSite=Strict`, e a API
verifica a origem em requisições de escrita por cookie. A sessão via cookie
dura até 8 horas. Em hospedagem separada, a sessão web dura até uma hora e
fica em memória. Uma recarga exige novo login. Android e iOS continuam
usando o armazenamento seguro do dispositivo.

A API limita tráfego por IP do cliente direto e aplica limites adicionais
por conta na busca e nas alterações de jogos e convocações. Em produção
com proxy ou múltiplas instâncias, configure no gateway limites distribuídos
e controle de IP conforme a topologia do ambiente.
