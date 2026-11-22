const key = 'agenda-de-jogos.session';

export const sessionStorage = {
  read: async () => null,
  write: async () => undefined,
  clear: async () => window.sessionStorage.removeItem(key),
};
