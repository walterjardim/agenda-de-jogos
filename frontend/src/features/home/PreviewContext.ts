import { createContext, useContext } from 'react';
import type {
  Athlete,
  Competition,
  MatchDetail,
  MatchInput,
} from '../matches/model';

type Preview = {
  openPreview: () => void;
  closePreview: () => void;
  followingAjax: boolean;
  setFollowingAjax: (following: boolean) => void;
  selectedPreviewTeam: boolean;
  choosePreviewTeam: () => void;
  previewMatches: MatchDetail[];
  previewAthletes: Athlete[];
  previewCompetitions: Competition[];
  savePreviewRecord: (
    input: Omit<Athlete, 'id'> | Omit<Competition, 'id'>,
    id?: string,
  ) => void;
  deletePreviewRecord: (kind: 'athletes' | 'competitions', id: string) => void;
  addPreviewMatch: (input: MatchInput) => void;
  changePreviewMatch: (
    id: string,
    change: (match: MatchDetail) => MatchDetail | null,
  ) => void;
};

export const PreviewContext = createContext<Preview | null>(null);

export function usePreview() {
  const preview = useContext(PreviewContext);

  if (!preview) {
    throw new Error('A prévia deve ser usada dentro do layout do aplicativo.');
  }

  return preview;
}
