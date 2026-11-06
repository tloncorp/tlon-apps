// src/assets.d.ts
// Bun imports a file as a string with `with { type: 'text' }` (embedded in the compiled binary at build time).
declare module '*.md' {
  const text: string;
  export default text;
}
