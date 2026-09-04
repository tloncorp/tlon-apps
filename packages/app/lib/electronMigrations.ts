const MIGRATION_STATEMENT_BREAKPOINT = '--> statement-breakpoint';

type MigrationConfig = {
  journal?: { entries?: { tag: string }[] };
  migrations: Record<string, string>;
};

export function formatElectronMigrations(migrationConfig: MigrationConfig) {
  const formattedMigrations: { sql: string[] }[] = [];

  if (migrationConfig.journal?.entries) {
    for (const entry of migrationConfig.journal.entries) {
      const migrationHash = `m${entry.tag.split('_')[0]}`;
      const migrationSql = migrationConfig.migrations[migrationHash];

      if (migrationSql) {
        formattedMigrations.push({
          // The main process catches already-exists errors per array item.
          // Splitting here lets an upgraded database skip old statements and
          // continue to newly generated tables and indexes in the same file.
          sql: migrationSql
            .split(MIGRATION_STATEMENT_BREAKPOINT)
            .map((statement) => statement.trim())
            .filter(Boolean),
        });
      }
    }
  }

  return formattedMigrations;
}
