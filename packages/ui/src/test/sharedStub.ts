// Minimal stand-in for `@tloncorp/shared` in unit tests. The real barrel pulls
// Flow-typed React Native sources into vitest's transform chain, which its
// parser can't read.
export const createDevLogger = () => ({
  log: () => {},
  trackError: () => {},
  trackEvent: () => {},
});
