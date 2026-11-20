import { Temporal } from "@js-temporal/polyfill";
import type { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";

export const messageSelect = {
  opponent: true,
  startsAt: true,
  location: true,
  notes: true,
  refereeFeeCents: true,
  team: { select: { name: true, category: true } },
  competition: { select: { name: true } },
  shirtPiece: { select: { uniformName: true, description: true } },
  shortsPiece: { select: { uniformName: true, description: true } },
  socksPiece: { select: { uniformName: true, description: true } },
  callups: {
    orderBy: { athlete: { shirtNumber: "asc" } },
    select: {
      athlete: { select: { name: true, shirtNumber: true, position: true } },
    },
  },
} satisfies Prisma.MatchSelect;

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function messageTime(instant: Temporal.Instant, timezone: string) {
  const local = instant.toZonedDateTimeISO(timezone);
  const date = local.toPlainDate().toString().split("-").reverse().join("/");
  const time = local.toPlainTime().toString({ smallestUnit: "minute" });
  return `${weekdays[local.dayOfWeek - 1]}, ${date} às ${time}`;
}

export function buildMatchMessage(
  match: Prisma.MatchGetPayload<{ select: typeof messageSelect }>,
  timezone: string,
  type: "sheet" | "callup",
) {
  if (type === "callup" && match.callups.length === 0) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Selecione pelo menos um atleta para compartilhar a convocação",
    );
  }
  const startsAt = Temporal.Instant.from(match.startsAt.toISOString());
  const lines = [
    `⚽ ${match.team.name} (${match.team.category}) x ${match.opponent}`,
  ];
  if (match.competition) lines.push(`🏆 Competição: ${match.competition.name}`);
  lines.push(
    `📅 Jogo: ${messageTime(startsAt, timezone)}`,
    `⏰ Chegada dos atletas: ${messageTime(startsAt.subtract({ hours: 1 }), timezone)}`,
  );
  if (match.location) lines.push(`📍 ${match.location}`);
  for (const [label, piece] of [
    ["👕 Camisa", match.shirtPiece],
    ["🩳 Calção", match.shortsPiece],
    ["🧦 Meião", match.socksPiece],
  ] as const) {
    if (piece)
      lines.push(`${label}: ${piece.uniformName} — ${piece.description}`);
  }
  if (match.refereeFeeCents !== null) {
    const fee = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
      .format(match.refereeFeeCents / 100)
      .replace(/\u00a0/g, " ");
    lines.push(`💰 Taxa de arbitragem: ${fee} por atleta`);
  }
  if (match.notes?.trim()) lines.push("📝 Observações:", match.notes);
  if (type === "callup") {
    lines.push(
      "",
      "Convocados:",
      ...match.callups.map(
        ({ athlete }) =>
          `${athlete.shirtNumber} - ${athlete.name} (${athlete.position})`,
      ),
    );
  }
  const text = lines.join("\n");
  return {
    type,
    text,
    whatsappUrl:
      Array.from(text).length <= 2000
        ? `https://wa.me/?text=${encodeURIComponent(text)}`
        : null,
  };
}
