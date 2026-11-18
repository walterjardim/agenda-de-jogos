import { useRef, useState } from 'react';
import type {
  Athlete,
  Competition,
  MatchDetail,
  MatchInput,
} from '../matches/model';
import {
  previewAthletes,
  previewCatalog,
  previewMatch,
} from '../matches/preview';
import type { RecordInput, RecordKind } from '../teams/api';

function initialData() {
  return {
    athletes: previewAthletes,
    competitions: previewCatalog.competitions,
    matches: [] as MatchDetail[],
  };
}

export function usePreviewTeamData() {
  const [data, setData] = useState(initialData);
  const nextId = useRef(1);

  function addPreviewMatch(input: MatchInput) {
    const id = `preview-${nextId.current++}`;
    setData((current) => ({
      ...current,
      matches: [
        ...current.matches,
        previewMatch(input, id, undefined, current.competitions),
      ],
    }));
  }

  function changePreviewMatch(
    id: string,
    change: (match: MatchDetail) => MatchDetail | null,
  ) {
    setData((current) => ({
      ...current,
      matches: current.matches.flatMap((match) => {
        if (match.id !== id) return [match];
        const updated = change(match);
        return updated ? [updated] : [];
      }),
    }));
  }

  function savePreviewRecord(input: RecordInput, id?: string) {
    const recordId = id ?? `preview-${nextId.current++}`;
    if ('shirtNumber' in input) {
      const athlete: Athlete = { id: recordId, ...input };
      setData((current) => ({
        ...current,
        athletes: id
          ? current.athletes.map((item) => (item.id === id ? athlete : item))
          : [...current.athletes, athlete],
        matches: id
          ? current.matches.map((match) => ({
              ...match,
              callups: match.callups
                .map((item) =>
                  item.athleteId === id
                    ? {
                        athleteId: id,
                        name: athlete.name,
                        shirtNumber: athlete.shirtNumber,
                        position: athlete.position,
                      }
                    : item,
                )
                .sort((a, b) => a.shirtNumber - b.shirtNumber),
            }))
          : current.matches,
      }));
    } else {
      const competition: Competition = { id: recordId, ...input };
      setData((current) => ({
        ...current,
        competitions: id
          ? current.competitions.map((item) =>
              item.id === id ? competition : item,
            )
          : [...current.competitions, competition],
        matches: id
          ? current.matches.map((match) =>
              match.competitionId === id ? { ...match, competition } : match,
            )
          : current.matches,
      }));
    }
  }

  function deletePreviewRecord(kind: RecordKind, id: string) {
    setData((current) => {
      if (kind === 'competitions') {
        return {
          ...current,
          competitions: current.competitions.filter((item) => item.id !== id),
          matches: current.matches.map((match) =>
            match.competitionId === id
              ? {
                  ...match,
                  competitionId: null,
                  competition: null,
                }
              : match,
          ),
        };
      }

      return {
        ...current,
        athletes: current.athletes.filter((item) => item.id !== id),
        matches: current.matches.map((match) => {
          const callups = match.callups.filter((item) => item.athleteId !== id);
          return { ...match, callups, callupsCount: callups.length };
        }),
      };
    });
  }

  return {
    previewMatches: data.matches,
    previewAthletes: data.athletes,
    previewCompetitions: data.competitions,
    addPreviewMatch,
    changePreviewMatch,
    savePreviewRecord,
    deletePreviewRecord,
    resetPreviewData: () => setData(initialData()),
  };
}
