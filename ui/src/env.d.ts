interface ImportMetaEnv
  extends Readonly<Record<string, string | boolean | undefined>> {
  readonly VITE_LAST_WIPE: string;
  readonly VITE_STORAGE_VERSION: string;
  readonly VITE_APP: 'groups' | 'chat';
  readonly VITE_ENABLE_WDYR: 'true' | 'false' | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
