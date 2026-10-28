import catalog from './command-catalog.json';

export type TopLevelCommand = keyof typeof catalog;
export const TOP_LEVEL_COMMANDS = Object.keys(catalog) as TopLevelCommand[];
export const TOP_LEVEL_COMMAND_SET: ReadonlySet<string> = new Set(
  TOP_LEVEL_COMMANDS
);

export function formatCommandIndex(): string {
  return TOP_LEVEL_COMMANDS.map(
    (name) => `  ${name.padEnd(13)}${catalog[name].summary}`
  ).join('\n');
}

export function isTopLevelCommand(
  command: string | undefined
): command is TopLevelCommand {
  return command !== undefined && TOP_LEVEL_COMMAND_SET.has(command);
}
