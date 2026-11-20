import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { createDatabase } from "../src/database.js";
import {
  buildMatchMessage,
  messageSelect,
  uniformColorEmoji,
} from "../src/matches/message.js";

function example() {
  return {
    team: { name: "Escolinha Tigres", category: "Sub-11" },
    opponent: "Tigres",
    startsAt: new Date("2026-10-12T12:00:00Z"),
    competition: { name: "Copa Municipal 2026" },
    location: "Campo Municipal",
    shirtPiece: {
      uniformName: "Casa",
      description: "Azul",
      colorHex: "#1E40AF",
    },
    shortsPiece: {
      uniformName: "Fora",
      description: "Branco",
      colorHex: "#FFFFFF",
    },
    socksPiece: {
      uniformName: "Casa",
      description: "Azul",
      colorHex: "#1E40AF",
    },
    refereeFeeCents: 1500,
    notes:
      "Levar RG\nLevar caneleira\nPix para pagamento da taxa: chave informada pelo time",
    callups: [
      { athlete: { name: "João Silva", shirtNumber: 1, position: "Goleiro" } },
      { athlete: { name: "Pedro Lima", shirtNumber: 4, position: "Zagueiro" } },
    ],
  };
}

test("ícone representa o hexadecimal e trata cores neutras e tons próximos", () => {
  for (const [hex, emoji] of [
    ["#000000", "⚫"],
    ["#ffffff", "⚪"],
    ["#808080", "🔘"],
    ["#E2222B", "🔴"],
    ["#F57C00", "🟠"],
    ["#FDD835", "🟡"],
    ["#15803D", "🟢"],
    ["#1e40af", "🔵"],
    ["#8E24AA", "🟣"],
    ["#795548", "🟤"],
  ])
    assert.equal(uniformColorEmoji(hex!), emoji);
  const match = example();
  const message = buildMatchMessage(
    { ...match, shirtPiece: { description: "Listrada", colorHex: "#E2222B" } },
    "America/Sao_Paulo",
    "sheet",
  );
  assert.match(message.text, /🔴 Camisa: Listrada/);
  assert.doesNotMatch(message.text, /Casa —/);
});

test("mensagem segue o texto do MVP e codifica o conteúdo completo", () => {
  const match = example();
  const message = buildMatchMessage(match, "America/Sao_Paulo", "callup");
  assert.equal(message.type, "callup");
  assert.equal(
    message.text,
    [
      "Relação Copa Municipal 2026",
      "",
      "⚽ *Escolinha Tigres x Tigres*",
      "🏆 Competição: Copa Municipal 2026",
      "📅 *Data: Seg, 12/10/2026 às 09:00*",
      "⏰ Chegada dos atletas: 08:00",
      "📍 Local: Campo Municipal",
      "🔵 Camisa: Azul",
      "⚪ Calção: Branco",
      "🔵 Meião: Azul",
      "💰 Taxa de arbitragem: R$ 15,00 por atleta",
      "📝 Observações:",
      match.notes,
      "",
      "Convocados:",
      "1 - João Silva",
      "4 - Pedro Lima",
    ].join("\n"),
  );
  assert.equal(
    new URL(message.whatsappUrl!).searchParams.get("text"),
    message.text,
  );
  const sheet = buildMatchMessage(match, "America/Sao_Paulo", "sheet");
  assert.equal(sheet.text, message.text.split("\n\nConvocados:")[0]);
  assert.doesNotMatch(sheet.text, /Total|estimado/);
});

test("ficha vazia, campos opcionais, taxa zero e chegada no dia anterior", () => {
  const match = {
    ...example(),
    competition: null,
    location: null,
    shirtPiece: null,
    shortsPiece: null,
    socksPiece: null,
    refereeFeeCents: null,
    notes: " \n ",
    callups: [],
    startsAt: new Date("2026-01-01T03:30:00Z"),
  };
  const sheet = buildMatchMessage(match, "America/Sao_Paulo", "sheet");
  assert.equal(
    sheet.text,
    [
      "Relação",
      "",
      "⚽ *Escolinha Tigres x Tigres*",
      "📅 *Data: Qui, 01/01/2026 às 00:30*",
      "⏰ Chegada dos atletas: 23:30",
    ].join("\n"),
  );
  assert.throws(() => buildMatchMessage(match, "America/Sao_Paulo", "callup"), {
    statusCode: 422,
  });
  const zero = buildMatchMessage(
    { ...match, refereeFeeCents: 0 },
    "America/Sao_Paulo",
    "sheet",
  );
  assert.match(zero.text, /R\$ 0,00 por atleta/);
  const mixed = buildMatchMessage(
    { ...match, shirtPiece: example().shirtPiece },
    "America/Sao_Paulo",
    "sheet",
  );
  assert.match(mixed.text, /🔵 Camisa: Azul/);
  assert.doesNotMatch(mixed.text, /Calção|Meião/);
  const changedTimezone = buildMatchMessage(match, "Asia/Tokyo", "sheet");
  assert.match(changedTimezone.text, /01\/01\/2026 às 12:30/);
  const dst = buildMatchMessage(
    { ...match, startsAt: new Date("2026-03-08T07:30:00Z") },
    "America/New_York",
    "sheet",
  );
  assert.match(dst.text, /\*Data: Dom, 08\/03\/2026 às 03:30\*/);
  assert.match(dst.text, /Chegada dos atletas: 01:30/);
});

test("limiar de 2000 caracteres preserva observações e emojis sem truncar", () => {
  const match = example();
  const base = buildMatchMessage(
    { ...match, notes: "x" },
    "America/Sao_Paulo",
    "sheet",
  );
  const fillerLength = 2000 - Array.from(base.text).length;
  const boundary = buildMatchMessage(
    { ...match, notes: "x".repeat(fillerLength) + "⚽" },
    "America/Sao_Paulo",
    "sheet",
  );
  assert.equal(Array.from(boundary.text).length, 2000);
  assert.equal(
    new URL(boundary.whatsappUrl!).searchParams.get("text"),
    boundary.text,
  );
  const long = buildMatchMessage(
    { ...match, notes: "x".repeat(fillerLength) + "⚽\n" },
    "America/Sao_Paulo",
    "sheet",
  );
  assert.equal(long.whatsappUrl, null);
  assert.equal(long.text, boundary.text + "\n");
  const multiline = buildMatchMessage(
    { ...match, notes: "  Levar RG\n\nPix: & + # <texto>  " },
    "America/Sao_Paulo",
    "sheet",
  );
  assert.ok(
    multiline.text.endsWith(
      "📝 Observações:\n  Levar RG\n\nPix: & + # <texto>  ",
    ),
  );
  assert.equal(
    new URL(multiline.whatsappUrl!).searchParams.get("text"),
    multiline.text,
  );
});

test("rota exige sessão e vínculo, valida tipo e usa o fuso atual do perfil", async (t) => {
  const userId = randomUUID();
  const id = randomUUID();
  let accessible = true;
  let validSession = true;
  let timezone = "America/Sao_Paulo";
  const match = example();
  const db = {
    authSession: {
      findUnique: async () =>
        validSession ? { user: { id: userId, timezone } } : null,
    },
    match: {
      findUnique: async (args: any) => {
        assert.deepEqual(args.where, {
          id,
          team: { OR: [{ userId }, { followers: { some: { userId } } }] },
        });
        assert.deepEqual(args.select, messageSelect);
        assert.deepEqual(args.select.callups.orderBy, {
          athlete: { shirtNumber: "asc" },
        });
        return accessible ? match : null;
      },
    },
  };
  const app = buildApp({
    db: db as unknown as PrismaClient,
    sessionTtlHours: 1,
    verifyGoogleIdentity: async () => {
      throw new Error("unused");
    },
  });
  t.after(() => app.close());
  const url = `/api/v1/matches/${id}/message`;
  const headers = { authorization: `Bearer ${"a".repeat(43)}` };
  assert.equal((await app.inject({ url })).statusCode, 401);
  validSession = false;
  assert.equal((await app.inject({ url, headers })).statusCode, 401);
  validSession = true;
  for (const query of [
    "type=bad",
    "type=",
    "type=sheet&type=callup",
    "userId=x",
  ]) {
    assert.equal(
      (await app.inject({ url: `${url}?${query}`, headers })).statusCode,
      400,
    );
  }
  const response = await app.inject({ url, headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().type, "callup");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(
    (await app.inject({ url: `${url}?type=sheet`, headers })).json().type,
    "sheet",
  );
  timezone = "Asia/Tokyo";
  assert.match((await app.inject({ url, headers })).json().text, /21:00/);
  match.callups = [];
  assert.equal((await app.inject({ url, headers })).statusCode, 422);
  assert.equal(
    (await app.inject({ url: `${url}?type=sheet`, headers })).statusCode,
    200,
  );
  accessible = false;
  assert.equal((await app.inject({ url, headers })).statusCode, 404);
});

test(
  "PostgreSQL gera texto com referências atuais e revoga acesso do seguidor",
  {
    skip: process.env.TEST_DATABASE_URL
      ? false
      : "Configure TEST_DATABASE_URL com PostgreSQL migrado",
  },
  async (t) => {
    const db = createDatabase(process.env.TEST_DATABASE_URL!);
    const prefix = randomUUID();
    const app = buildApp({
      db,
      sessionTtlHours: 1,
      verifyGoogleIdentity: async (sub) => ({
        sub: prefix + sub,
        email: `${sub}@example.com`,
        name: sub,
      }),
    });
    t.after(async () => {
      await app.close();
      try {
        await db.user.deleteMany({
          where: { googleSub: { startsWith: prefix } },
        });
      } finally {
        await db.$disconnect();
      }
    });
    async function login(idToken: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/google",
        payload: { idToken },
      });
      assert.equal(response.statusCode, 200);
      return {
        user: response.json().user,
        headers: { authorization: `Bearer ${response.json().sessionToken}` },
      };
    }
    const owner = await login("owner");
    const follower = await login("follower");
    const outsider = await login("outsider");
    const team = await db.team.create({
      data: {
        userId: owner.user.id,
        name: "Time",
        sport: "Futsal",
        category: "Sub-11",
      },
    });
    await db.teamFollow.create({
      data: { userId: follower.user.id, teamId: team.id },
    });
    const competition = await db.competition.create({
      data: { teamId: team.id, name: "Copa" },
    });
    const shirt = await db.uniformPiece.create({
      data: {
        teamId: team.id,
        pieceType: "shirt",
        uniformName: "Casa",
        description: "Azul",
      },
    });
    const athletes = await Promise.all(
      [9, 1].map((shirtNumber) =>
        db.athlete.create({
          data: {
            teamId: team.id,
            name: `Atleta ${shirtNumber}`,
            position: "Jogador",
            shirtNumber,
          },
        }),
      ),
    );
    const match = await db.match.create({
      data: {
        teamId: team.id,
        competitionId: competition.id,
        shirtPieceId: shirt.id,
        opponent: "Rival",
        startsAt: new Date("2026-10-12T12:00:00Z"),
        refereeFeeCents: 0,
        hasSavedCallup: true,
        callups: { create: athletes.map(({ id }) => ({ athleteId: id })) },
      },
    });
    const url = `/api/v1/matches/${match.id}/message`;
    assert.equal(
      (await app.inject({ url, headers: outsider.headers })).statusCode,
      404,
    );
    const response = await app.inject({ url, headers: follower.headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(
      response.json().text.indexOf("1 - Atleta 1") <
        response.json().text.indexOf("9 - Atleta 9"),
    );
    await db.uniformPiece.update({
      where: { id: shirt.id },
      data: { description: "Vermelha", colorHex: "#E53935" },
    });
    await db.competition.update({
      where: { id: competition.id },
      data: { name: "Copa nova" },
    });
    await db.athlete.update({
      where: { id: athletes[0]!.id },
      data: { name: "Nome novo" },
    });
    const changed = (await app.inject({ url, headers: owner.headers })).json();
    assert.match(changed.text, /🔴 Camisa: Vermelha/);
    assert.match(changed.text, /Copa nova/);
    assert.match(changed.text, /9 - Nome novo/);
    await db.teamFollow.delete({
      where: { userId_teamId: { userId: follower.user.id, teamId: team.id } },
    });
    assert.equal(
      (await app.inject({ url, headers: follower.headers })).statusCode,
      404,
    );
  },
);
