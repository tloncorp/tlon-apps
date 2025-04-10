export default function useIsStandaloneMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return isStandalone;
}
