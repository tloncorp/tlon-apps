export const TOP_LEVEL_COMMANDS = [
  'activity',
  'channels',
  'contacts',
  'dms',
  'expose',
  'groups',
  'hooks',
  'messages',
  'notebook',
  'posts',
  'settings',
  'upload',
] as const;

export type TopLevelCommand = (typeof TOP_LEVEL_COMMANDS)[number];

export const TOP_LEVEL_COMMAND_SET: ReadonlySet<string> = new Set(
  TOP_LEVEL_COMMANDS
);

export function isTopLevelCommand(
  command: string | undefined
): command is TopLevelCommand {
  return command !== undefined && TOP_LEVEL_COMMAND_SET.has(command);
}
