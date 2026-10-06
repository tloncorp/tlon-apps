// Injected at build time via `bun build --define __VERSION__` (scripts/build.js,
// scripts/build-all.js). Under plain `bun`/`bun test` it is undefined.
declare const __VERSION__: string;
export const CLI_VERSION =
  typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';
