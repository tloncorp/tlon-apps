export const isElectron = () =>
  typeof window !== 'undefined' &&
  window.navigator &&
  window.navigator.userAgent &&
  window.navigator.userAgent.indexOf('Electron') >= 0;

export const useIsElectron = () => {
  return isElectron();
};
