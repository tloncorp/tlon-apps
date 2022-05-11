type ImportMetaEnv = Readonly<Record<string, string | boolean | undefined>>;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'urbit-ob' {
  function isValidPatp(ship: string): boolean;

}
