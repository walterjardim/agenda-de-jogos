import { Temporal } from "@js-temporal/polyfill";
import type { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../http/errors.js";

export const messageSelect = {
  opponent: true,
  startsAt: true,
  location: true,
  notes: true,
  refereeFeeCents: true,
  team: { select: { name: true } },
  competition: { select: { name: true } },
  shirtPiece: { select: { colorHex: true, description: true } },
  shortsPiece: { select: { colorHex: true, description: true } },
  socksPiece: { select: { colorHex: true, description: true } },
  callups: {
    orderBy: { athlete: { shirtNumber: "asc" } },
    select: {
      athlete: { select: { name: true, shirtNumber: true } },
    },
  },
} satisfies Prisma.MatchSelect;

const uniformColors = [
  ["⚫", "#000000"],
  ["🔘", "#808080"],
  ["⚪", "#FFFFFF"],
  ["🔴", "#E53935"],
  ["🟠", "#F57C00"],
  ["🟡", "#FDD835"],
  ["🟢", "#43A047"],
  ["🔵", "#1E40AF"],
  ["🟣", "#8E24AA"],
  ["🟤", "#795548"],
] as const;

export function uniformColorEmoji(colorHex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(colorHex)) return "⚪";
  const channels = [1, 3, 5].map((offset) =>
    parseInt(colorHex.slice(offset, offset + 2), 16),
  );
  const neutral = Math.max(...channels) - Math.min(...channels) <= 24;
  const palette = neutral ? uniformColors.slice(0, 3) : uniformColors;
  let closest: string = palette[0]![0];
  let shortestDistance = Infinity;
  for (const [emoji, hex] of palette) {
    const distance = channels.reduce((total, channel, index) => {
      const candidate = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
      return total + (channel - candidate) ** 2;
    }, 0);
    if (distance < shortestDistance) {
      closest = emoji;
      shortestDistance = distance;
    }
  }
  return closest;
}

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
  const arrivalTime = startsAt
    .subtract({ hours: 1 })
    .toZonedDateTimeISO(timezone)
    .toPlainTime()
    .toString({ smallestUnit: "minute" });
  const lines = [
    match.competition ? `Relação ${match.competition.name}` : "Relação",
    "",
    `⚽ *${match.team.name} x ${match.opponent}*`,
  ];
  if (match.competition) lines.push(`🏆 Competição: ${match.competition.name}`);
  lines.push(
    `📅 *Data: ${messageTime(startsAt, timezone)}*`,
    `⏰ Chegada dos atletas: ${arrivalTime}`,
  );
  if (match.location) lines.push(`📍 Local: ${match.location}`);
  for (const [label, piece] of [
    ["Camisa", match.shirtPiece],
    ["Calção", match.shortsPiece],
    ["Meião", match.socksPiece],
  ] as const) {
    if (piece)
      lines.push(
        `${uniformColorEmoji(piece.colorHex)} ${label}: ${piece.description}`,
      );
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
        ({ athlete }) => `${athlete.shirtNumber} - ${athlete.name}`,
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
