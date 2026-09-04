/**
 * Inert stand-in for the React Native / Expo modules `@tloncorp/shared`
 * imports transitively. The seed runs the REAL store, api and db code
 * against a REAL ship; only the device-only leaves are stubbed, and every
 * one of them is a module the store never calls on the paths the seed
 * exercises. (`packages/shared/src/test/setup.ts` stubs the same set for
 * the same reason.)
 *
 * Any access returns a no-op function rather than throwing, so an
 * unexpected call degrades to "did nothing" instead of taking the seed
 * down mid-write and leaving the ship half-seeded.
 */
const handler: ProxyHandler<Record<string, unknown>> = {
  get: (_target, property) => {
    if (property === 'default') {
      return new Proxy({}, handler);
    }
    if (property === '__esModule') {
      return true;
    }
    return () => undefined;
  },
};

export default new Proxy({}, handler);
