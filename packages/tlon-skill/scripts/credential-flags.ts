import type { CliCredentialOverrides } from './credential-resolver';
import { TOP_LEVEL_COMMAND_SET } from './top-level-commands';

const CREDENTIAL_FLAGS = ['config', 'url', 'ship', 'code', 'cookie'] as const;
type CredentialFlag = (typeof CREDENTIAL_FLAGS)[number];

export class CredentialFlagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialFlagError';
  }
}

export interface ParsedGlobalCliOptions {
  args: string[];
  verbose: boolean;
  credentialOverrides: CliCredentialOverrides | null;
}

function isCredentialFlagName(name: string): name is CredentialFlag {
  return (CREDENTIAL_FLAGS as readonly string[]).includes(name);
}

function flagLabel(flag: CredentialFlag): string {
  return `--${flag}`;
}

function invalidFormsMessage(): string {
  return (
    'Invalid credential flags: use one of ' +
    '--config <file>, --url <url> --cookie <cookie> [--ship <ship>] [--code <code>], ' +
    '--url <url> --ship <ship> --code <code>, or --ship <ship> when available in TLON_SKILL_DIR or cache.'
  );
}

function buildCredentialOverrides(
  flags: Partial<Record<CredentialFlag, string>>
): CliCredentialOverrides | null {
  const present = CREDENTIAL_FLAGS.filter((flag) => flags[flag] !== undefined);
  if (present.length === 0) return null;

  const configFile = flags.config;
  const url = flags.url;
  const ship = flags.ship;
  const code = flags.code;
  const cookie = flags.cookie;

  if (configFile) {
    if (present.length > 1) {
      throw new CredentialFlagError(
        'Invalid credential flags: --config cannot be combined with --url, --ship, --code, or --cookie.'
      );
    }
    return { kind: 'config', configFile };
  }

  if (url && cookie) {
    return { kind: 'cookie', url, cookie, ship, code };
  }

  if (url && ship && code) {
    return { kind: 'code', url, ship, code };
  }

  if (ship && !url && !code && !cookie) {
    return { kind: 'ship', ship };
  }

  throw new CredentialFlagError(invalidFormsMessage());
}

export function parseGlobalCliOptions(
  rawArgs: string[],
  knownCommands: ReadonlySet<string> = TOP_LEVEL_COMMAND_SET
): ParsedGlobalCliOptions {
  const flags: Partial<Record<CredentialFlag, string>> = {};
  const seen = new Set<CredentialFlag>();
  const args: string[] = [];
  let verbose = false;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const inlineMatch = arg.match(/^--([^=]+)=(.*)$/);
      const flagName = inlineMatch ? inlineMatch[1] : arg.slice(2);

      if (isCredentialFlagName(flagName)) {
        const flag = flagName;
        if (seen.has(flag)) {
          throw new CredentialFlagError(
            `Duplicate credential flag: ${flagLabel(flag)}`
          );
        }
        seen.add(flag);

        if (inlineMatch) {
          const value = inlineMatch[2];
          if (value.length === 0) {
            throw new CredentialFlagError(
              `Missing value for ${flagLabel(flag)}`
            );
          }
          flags[flag] = value;
          continue;
        }

        const value = rawArgs[i + 1];
        if (!value || value.startsWith('--') || knownCommands.has(value)) {
          throw new CredentialFlagError(`Missing value for ${flagLabel(flag)}`);
        }

        flags[flag] = value;
        i += 1;
        continue;
      }
    }

    args.push(...rawArgs.slice(i));
    break;
  }

  return {
    args,
    verbose,
    credentialOverrides: buildCredentialOverrides(flags),
  };
}
