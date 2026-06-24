/**
 * CLI argument parsing utilities
 */

/**
 * Get an option value from command line args
 * @param args Array of arguments
 * @param name Option name (without --)
 * @param startIndex Index to begin searching from
 * @returns The option value or undefined
 */
export function getOption(
  args: string[],
  name: string,
  startIndex = 0
): string | undefined {
  const idx = args.indexOf(`--${name}`, startIndex);
  if (idx !== -1 && args[idx + 1] !== undefined) {
    return args[idx + 1];
  }
  return undefined;
}

export function hasOptionValue(
  args: string[],
  name: string,
  knownOptionNames: readonly string[] = []
): boolean {
  const idx = args.indexOf(`--${name}`);
  const value = idx !== -1 ? args[idx + 1] : undefined;
  if (value === undefined) {
    return false;
  }

  return !knownOptionNames.some((optionName) => value === `--${optionName}`);
}

/**
 * Check if a flag is present in args
 * @param args Array of arguments
 * @param name Flag name (without --)
 * @returns true if flag is present
 */
export function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

/**
 * Read the value after an option that requires one.
 */
export function getRequiredOptionValue(
  args: string[],
  index: number,
  flag = args[index]
): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

/**
 * Check if help was requested for a command/subcommand
 */
export function wantsHelp(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}

export function isHelpArg(arg: string | undefined): boolean {
  return arg === '--help' || arg === '-h';
}

export function isSubcommandHelpRequest(args: string[]): boolean {
  return args.length === 2 && isHelpArg(args[1]);
}

export function isCommandHelpRequest(args: string[]): boolean {
  return args.length === 1 && isHelpArg(args[0]);
}

export function printHelpAndExit(help: string): never {
  console.log(help);
  process.exit(0);
}

export function printUsageAndExit(help: string): never {
  console.error(help);
  process.exit(1);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function printErrorAndExit(error: unknown): never {
  console.error(`Error: ${errorMessage(error)}`);
  process.exit(1);
}

export const CHANNEL_KINDS = ['chat', 'heap'] as const;

// Channel kinds the skill used to support but no longer does. The %diary backend
// is being removed, so diary/notebook channels are refused everywhere with an
// explanatory message pointing at %notes.
export const REMOVED_CHANNEL_KINDS = ['diary'] as const;

// Single, consistent refusal message for every removed diary/notebook entry
// point (the `tlon notebook` command, `--kind diary`, and any `diary/...` nest).
// It says *why* — for agents (e.g. OpenClaw) and humans with stale habits — not a
// generic "unknown command/kind" or backend "channel not found".
export const DIARY_REMOVED =
  'diary/notebook channels are no longer supported — they have been replaced by %notes. Use `tlon notes` (see `tlon notes --help`).';

// True for a nest addressing a diary channel (e.g. `diary/~host/blog`).
export function isDiaryNest(nest: string | undefined): boolean {
  return !!nest && nest.startsWith('diary/');
}

// Legacy-module refusal: print `Error: <DIARY_REMOVED>` and exit nonzero. Fires
// before `ensureClient`, so the refusal is local, pre-auth, and deterministic.
export function refuseDiary(): never {
  printErrorAndExit(DIARY_REMOVED);
}

// Refuse a `diary/...` nest passed to any nest-accepting legacy command.
export function refuseDiaryNest(nest: string | undefined): void {
  if (isDiaryNest(nest)) {
    refuseDiary();
  }
}

/**
 * Detect the common mistake of passing channel kind positionally instead of via --kind.
 * Example: groups add-channel <group> chat "Title"
 */
export function looksLikePositionalChannelKind(
  args: string[],
  titleIndex: number,
  kindOptionName = 'kind'
): boolean {
  const title = args[titleIndex];
  const nextPositional = args[titleIndex + 1];
  return (
    !!title &&
    CHANNEL_KINDS.includes(title as (typeof CHANNEL_KINDS)[number]) &&
    !!nextPositional &&
    !getOption(args, kindOptionName)
  );
}

// Detect a removed channel kind (diary) passed positionally where a kind would
// go. `CHANNEL_KINDS` no longer lists diary, so `looksLikePositionalChannelKind`
// can't catch it — without this guard `diary` would be silently taken as the
// channel title down the default-kind path.
export function looksLikeRemovedPositionalChannelKind(
  args: string[],
  titleIndex: number,
  kindOptionName = 'kind'
): boolean {
  const title = args[titleIndex];
  const nextPositional = args[titleIndex + 1];
  return (
    !!title &&
    REMOVED_CHANNEL_KINDS.includes(
      title as (typeof REMOVED_CHANNEL_KINDS)[number]
    ) &&
    !!nextPositional &&
    !getOption(args, kindOptionName)
  );
}

// Value of an equals-form `--kind=foo` option appearing after the title, or
// undefined. The space-separated parser used elsewhere (`getOption`) only reads
// `--kind foo`, so equals-form is handled explicitly where it matters.
function equalsFormOptionValue(
  args: string[],
  titleIndex: number,
  optionName: string
): string | undefined {
  const prefix = `--${optionName}=`;
  const token = args
    .slice(titleIndex + 1)
    .find((arg) => arg.startsWith(prefix));
  return token === undefined ? undefined : token.slice(prefix.length);
}

// Refuse a removed `--kind diary` (flag, either `--kind diary` or `--kind=diary`)
// or positional `diary` on a create/add-channel command, before auth. Returns
// when no removed kind is present.
export function refuseRemovedChannelKind(
  args: string[],
  titleIndex: number,
  kindOptionName = 'kind'
): void {
  const kindOption =
    getOption(args, kindOptionName) ??
    equalsFormOptionValue(args, titleIndex, kindOptionName);
  if (
    (kindOption !== undefined &&
      REMOVED_CHANNEL_KINDS.includes(
        kindOption as (typeof REMOVED_CHANNEL_KINDS)[number]
      )) ||
    looksLikeRemovedPositionalChannelKind(args, titleIndex, kindOptionName)
  ) {
    refuseDiary();
  }
}

// Reject a value-less, equals-form, or unsupported `--kind` with a local usage
// error, before any backend call. Scans only the option region *after* the title
// (matching how the kind is actually read, `getOption(args, 'kind', titleIndex +
// 1)`), so a `--kind` token in the title slot is still treated as a literal
// title. A bare trailing `--kind` (no value) and the equals-form `--kind=heap`
// (which the space-only extractor can't read) must both fail loudly rather than
// silently default to chat. Run *after* refuseRemovedChannelKind so `diary` keeps
// its tailored DIARY_REMOVED message. Validates against CHANNEL_KINDS, so it
// auto-extends when a new kind (e.g. notes) is added.
export function assertKnownChannelKind(
  args: string[],
  titleIndex: number,
  usageHelp: string,
  kindOptionName = 'kind'
): void {
  const expected = `Expected ${CHANNEL_KINDS.join(' or ')}.`;

  // Equals-form isn't supported by the space-separated option parser used across
  // the CLI; reject it explicitly instead of letting it fall through and
  // silently default to chat.
  if (equalsFormOptionValue(args, titleIndex, kindOptionName) !== undefined) {
    printUsageAndExit(
      `Error: --${kindOptionName} does not accept "=" form; use "--${kindOptionName} <value>". ${expected}\n${usageHelp}`
    );
  }

  const idx = args.indexOf(`--${kindOptionName}`, titleIndex + 1);
  if (idx === -1) {
    return;
  }
  const value = args[idx + 1];
  if (value === undefined || value.startsWith('--')) {
    printUsageAndExit(
      `Error: --${kindOptionName} requires a value. ${expected}\n${usageHelp}`
    );
  }
  if (!CHANNEL_KINDS.includes(value as (typeof CHANNEL_KINDS)[number])) {
    printUsageAndExit(
      `Error: invalid --kind: ${value}. ${expected}\n${usageHelp}`
    );
  }
}
