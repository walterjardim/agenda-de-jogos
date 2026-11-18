import {
  arrivalFor,
  defaultPiece,
  formatFee,
  formatGameTime,
  type MessageType,
  type Athlete,
  type Callup,
  type Catalog,
  type MatchDetail,
  type MatchInput,
  type PieceType,
  type Team,
} from './model';

export const previewTeam: Team & { modality: string } = {
  id: 'preview-ajax',
  name: 'Ajax',
  modality: 'Futsal',
  isOwner: true,
  category: 'Sub-11',
};

export const previewTimezone = 'America/Sao_Paulo';

export const previewCatalog: Catalog = {
  competitions: [{ id: 'copa-municipal', name: 'Copa Municipal' }],
  uniforms: [
    {
      id: 'camisa-casa',
      pieceType: 'shirt',
      uniformName: 'Casa',
      description: 'Azul',
      isHomeDefault: true,
      isAwayDefault: false,
    },
    {
      id: 'calcao-fora',
      pieceType: 'shorts',
      uniformName: 'Fora',
      description: 'Branco',
      isHomeDefault: false,
      isAwayDefault: true,
    },
    {
      id: 'meiao-casa',
      pieceType: 'socks',
      uniformName: 'Casa',
      description: 'Azul',
      isHomeDefault: true,
      isAwayDefault: false,
    },
  ],
};

export const previewAthletes: Athlete[] = [
  {
    id: 'joao',
    name: 'João Silva',
    shirtNumber: 1,
    position: 'Goleiro',
    status: 'active',
  },
  {
    id: 'pedro',
    name: 'Pedro Lima',
    shirtNumber: 4,
    position: 'Zagueiro',
    status: 'injured',
  },
  {
    id: 'ana',
    name: 'Ana Santos',
    shirtNumber: 9,
    position: 'Atacante',
    status: 'suspended',
  },
];

export function previewMatch(
  body: MatchInput,
  id: string,
  savedCallups?: Callup[],
  competitions = previewCatalog.competitions,
): MatchDetail {
  const { uniforms } = previewCatalog;

  function resolvePiece(
    type: PieceType,
    selectedId: string | null | undefined,
  ) {
    if (selectedId === undefined)
      return defaultPiece(uniforms, type, body.isHome) ?? null;
    return (
      uniforms.find(
        (item) => item.pieceType === type && item.id === selectedId,
      ) ?? null
    );
  }

  return {
    ...body,
    id,
    teamId: previewTeam.id,
    arrivalAt: arrivalFor(body.startsAt),
    competition:
      competitions.find((item) => item.id === body.competitionId) ?? null,
    shirtPiece: resolvePiece('shirt', body.shirtPieceId),
    shortsPiece: resolvePiece('shorts', body.shortsPieceId),
    socksPiece: resolvePiece('socks', body.socksPieceId),
    callupsCount: savedCallups?.length ?? 0,
    callups: savedCallups ?? [],
    hasSavedCallup: savedCallups !== undefined,
  };
}

export function previewMessage(
  match: MatchDetail,
  timezone: string,
  type: MessageType,
) {
  if (type === 'callup' && match.callups.length === 0) return '';

  const lines = [
    `⚽ ${previewTeam.name} (${previewTeam.category}) x ${match.opponent}`,
  ];
  if (match.competition) lines.push(`🏆 Competição: ${match.competition.name}`);
  lines.push(
    `📅 Jogo: ${formatGameTime(match.startsAt, timezone).replace(' · ', ' às ')}`,
  );
  lines.push(
    `⏰ Chegada dos atletas: ${formatGameTime(match.arrivalAt, timezone).replace(' · ', ' às ')}`,
  );
  if (match.location) lines.push(`📍 ${match.location}`);

  for (const [label, piece] of [
    ['👕 Camisa', match.shirtPiece],
    ['🩳 Calção', match.shortsPiece],
    ['🧦 Meião', match.socksPiece],
  ] as const) {
    if (piece)
      lines.push(`${label}: ${piece.uniformName} — ${piece.description}`);
  }

  if (match.refereeFeeCents !== null) {
    lines.push(
      `💰 Taxa de arbitragem: ${formatFee(match.refereeFeeCents)} por atleta`,
    );
  }
  if (match.notes?.trim()) lines.push('📝 Observações:', match.notes);
  if (type === 'callup') {
    lines.push(
      '',
      'Convocados:',
      ...match.callups.map(
        ({ shirtNumber, name, position }) =>
          `${shirtNumber} - ${name} (${position})`,
      ),
    );
  }
  return lines.join('\n');
}
