const key = 'agenda-de-jogos.session';

export const sessionStorage = {
  read: async () => window.sessionStorage.getItem(key),
  write: async (value: string) => window.sessionStorage.setItem(key, value),
  clear: async () => window.sessionStorage.removeItem(key),
};
