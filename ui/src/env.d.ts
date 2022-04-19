type ImportMetaEnv = Readonly<Record<string, string | boolean | undefined>>;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
