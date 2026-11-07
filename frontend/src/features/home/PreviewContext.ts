import { createContext, useContext } from 'react';

type Preview = {
  openPreview: () => void;
  closePreview: () => void;
  followingAjax: boolean;
  setFollowingAjax: (following: boolean) => void;
};

export const PreviewContext = createContext<Preview | null>(null);

export function usePreview() {
  const preview = useContext(PreviewContext);

  if (!preview) {
    throw new Error('A prévia deve ser usada dentro do layout do aplicativo.');
  }

  return preview;
}
