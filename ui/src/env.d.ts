interface ImportMetaEnv
  extends Readonly<Record<string, string | boolean | undefined>> {
  readonly VITE_LAST_WIPE: string;
  readonly VITE_STORAGE_VERSION: string;
  readonly VITE_APP: 'groups' | 'chat';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'urbit-ob' {
  function isValidPatp(ship: string): boolean;
}
