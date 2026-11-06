// src/version.ts
declare const __VERSION__: string | undefined;
export const VERSION =
  typeof __VERSION__ === 'string' ? __VERSION__ : '0.1.0-dev';
