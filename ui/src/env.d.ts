interface ImportMetaEnv extends Readonly<Record<string, string | boolean | undefined>> {
  /* Add custom env properties here */
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
