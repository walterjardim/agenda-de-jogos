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

Após o login, a aba **Meus times** oferece cadastro, edição e exclusão com
confirmação, além de atualização da lista e tratamento de falhas de conexão.
A aba **Buscar** consulta as equipes cadastradas. **Escolher time** salva a
preferência e passa a acompanhar a equipe quando ela pertence a outro usuário.
Na home, **Trocar time** lista equipes próprias e acompanhadas, sem duplicá-las.

### Busca e seleção persistente

| Método e rota | Resultado |
| --- | --- |
| `GET /api/v1/teams?q=ajax&limit=20&cursor=<uuid>&mine=true` | `{ data, nextCursor }` com equipes e `isOwner` |
| `GET /api/v1/teams/:id` | Dados da equipe, sem dados pessoais do proprietário |
| `POST /api/v1/teams/:id/select` | Perfil com `activeTeamId` atualizado |

Todas as rotas exigem sessão. Na busca, `q` é opcional, tem até 100 caracteres
e procura um trecho literal do nome sem diferenciar maiúsculas de minúsculas.
`mine=true` limita aos times próprios ou acompanhados; o padrão é buscar todos.
`limit` varia de 1 a 50 (padrão 20). A paginação usa UUID crescente, e o cursor
pode continuar sendo usado se a equipe anterior for excluída.

A seleção verifica a existência da equipe e grava o vínculo de acompanhamento
e `users.active_team_id` numa única transação. Repetir a escolha não duplica o
vínculo. Ela não concede permissões de administração. Uma equipe inexistente
retorna `404`, preservando a escolha anterior.

O último time escolhido permanece ativo mesmo com várias equipes acompanhadas.
`GET /me` e novos logins retornam essa preferência; o app abre a agenda desse
time. Sem uma escolha (ou se o time foi excluído), abre a busca. Não há seleção
automática por ordem alfabética nem por data de cadastro.

A home carrega o time separadamente dos jogos para manter sua identificação e
a opção de troca disponíveis se a API de jogos falhar. As rotas de jogos ainda
não estão implementadas neste backend.

### Comandos

```powershell
npm run build
npm test
```

Os testes usam JWTs assinados localmente e fornecem uma chave pública de teste
à biblioteca do Google. Para executar também os testes de persistência,
configure `TEST_DATABASE_URL` com um PostgreSQL **de teste** que já recebeu a
migration. Os testes de persistência criam e removem seus próprios registros.
