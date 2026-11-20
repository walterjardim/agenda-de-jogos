import { Temporal } from '@js-temporal/polyfill';

export type Team = {
  id: string;
  name: string;
  category: string;
  isOwner?: boolean;
};
export type Competition = { id: string; name: string };
export type PieceType = 'shirt' | 'shorts' | 'socks';
export type UniformPiece = {
  id: string;
  pieceType: PieceType;
  colorHex: string;
  uniformName: string;
  description: string;
  isHomeDefault: boolean;
  isAwayDefault: boolean;
};

export type MatchInput = {
  opponent: string;
  startsAt: string;
  location: string | null;
  isHome: boolean;
  competitionId: string | null;
  shirtPieceId?: string | null;
  shortsPieceId?: string | null;
  socksPieceId?: string | null;
  refereeFeeCents: number | null;
  notes: string | null;
};

export type Match = MatchInput & {
  id: string;
  teamId: string;
  arrivalAt: string;
  competition: Competition | null;
  shirtPiece: UniformPiece | null;
  shortsPiece: UniformPiece | null;
  socksPiece: UniformPiece | null;
  callupsCount: number;
};

export type Athlete = {
  id: string;
  name: string;
  shirtNumber: number;
  position: string;
  status: 'active' | 'injured' | 'suspended';
};

export type Callup = Omit<Athlete, 'id' | 'status'> & { athleteId: string };
export type MatchDetail = Match & {
  callups: Callup[];
  hasSavedCallup?: boolean;
};
export type MessageType = 'sheet' | 'callup';

export function formatFee(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export type Catalog = { competitions: Competition[]; uniforms: UniformPiece[] };

export function weekInTimezone(timezone: string, now = Temporal.Now.instant()) {
  const date = now.toZonedDateTimeISO(timezone).toPlainDate();
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  const sunday = monday.add({ days: 6 });
  return {
    from: monday.toString(),
    to: sunday.toString(),
    label: `${formatDate(monday)} a ${formatDate(sunday)}`,
  };
}

export function formatDate(date: Temporal.PlainDate) {
  return date.toString().split('-').reverse().join('/');
}

export function localDate(timezone: string) {
  return formatDate(Temporal.Now.plainDateISO(timezone));
}

export function parseStart(date: string, time: string, timezone: string) {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!parts || !clock) return null;

  const [, day, month, year] = parts;
  const [, hour, minute] = clock;
  if (Number(year) === 0) return null;
  try {
    return Temporal.ZonedDateTime.from(
      {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
        timeZone: timezone,
      },
      { overflow: 'reject', disambiguation: 'reject' },
    )
      .toInstant()
      .toString();
  } catch {
    return null;
  }
}

export function arrivalFor(startsAt: string) {
  return Temporal.Instant.from(startsAt).subtract({ minutes: 60 }).toString();
}

export function formatGameTime(
  instant: string,
  timezone: string,
  includeDate = true,
) {
  const local = Temporal.Instant.from(instant).toZonedDateTimeISO(timezone);
  const time = local.toPlainTime().toString({ smallestUnit: 'minute' });
  return includeDate ? `${formatDate(local.toPlainDate())} · ${time}` : time;
}

export function gameDate(instant: string, timezone: string) {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();
}

export function gamesInWeek(
  matches: Match[],
  week: ReturnType<typeof weekInTimezone>,
  timezone: string,
) {
  return matches
    .filter(({ startsAt }) => {
      const day = gameDate(startsAt, timezone);
      return day >= week.from && day <= week.to;
    })
    .sort(
      (a, b) =>
        Temporal.Instant.compare(a.startsAt, b.startsAt) ||
        a.id.localeCompare(b.id),
    );
}

export function parseFee(value: string) {
  if (!value.trim()) return null;
  const amount = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value.trim());
  if (!amount) return undefined;
  const cents =
    Number(amount[1]) * 100 + Number((amount[2] ?? '').padEnd(2, '0'));
  return Number.isInteger(cents) && cents <= 2147483647 ? cents : undefined;
}

export function defaultPiece(
  uniforms: UniformPiece[],
  type: PieceType,
  isHome: boolean,
) {
  return uniforms.find(
    (piece) =>
      piece.pieceType === type &&
      (isHome ? piece.isHomeDefault : piece.isAwayDefault),
  );
}

export function pieceLabel(piece: UniformPiece) {
  return `${piece.uniformName} · ${piece.description}`;
}
