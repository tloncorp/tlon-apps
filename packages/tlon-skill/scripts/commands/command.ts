import { credentialFlagUsage } from '../credential-flags';

export type CommandWriter = (text: string) => void;

export interface CommandDeps {
  stdout: CommandWriter;
  stderr: CommandWriter;
}

export type CommandRunner<TDeps extends CommandDeps> = (
  args: string[],
  deps: TDeps
) => Promise<number>;

export class CommandError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CommandError';
    this.exitCode = exitCode;
  }
}

export class UsageError extends CommandError {
  readonly help: string;

  constructor(message: string | null, help: string) {
    super(message ?? '', 1);
    this.name = 'UsageError';
    this.help = help;
  }
}

export function commandError(message: string, exitCode = 1): CommandError {
  return new CommandError(message, exitCode);
}

export function usageError(help: string): UsageError;
export function usageError(message: string, help: string): UsageError;
export function usageError(messageOrHelp: string, help?: string): UsageError {
  if (help === undefined) {
    return new UsageError(null, messageOrHelp);
  }
  return new UsageError(messageOrHelp, help);
}

/**
 * An unknown option in `command` (`activity mentions`). A credential flag
 * there was meant for the global prefix: say so, naming only the flag since
 * an inline value may be a secret.
 */
export function unknownOptionError(
  arg: string,
  help: string,
  command: string
): UsageError {
  const credential = credentialFlagUsage(arg);
  if (credential) {
    return usageError(
      `Unknown option: ${credential.flag}. Credential flags go before the command: tlon ${credential.usage} ${command}`,
      help
    );
  }
  return usageError(`Unknown option: ${arg}`, help);
}

export function isHelpArg(arg: string | undefined): boolean {
  return arg === '--help' || arg === '-h';
}

export function writeLine(writer: CommandWriter, text = ''): void {
  writer(`${text}\n`);
}

export function writeHelp(deps: CommandDeps, help: string): number {
  writeLine(deps.stdout, help);
  return 0;
}

export function formatUnexpectedError(error: unknown): string {
  return `Error: ${errorMessage(error)}\n`;
}

export function handleExpectedCommandError(
  error: unknown,
  deps: CommandDeps
): number | null {
  if (error instanceof UsageError) {
    const message = error.message
      ? `Error: ${error.message}\n\n${error.help}`
      : error.help;
    writeLine(deps.stderr, message);
    return error.exitCode;
  }

  if (error instanceof CommandError) {
    writeLine(deps.stderr, `Error: ${error.message}`);
    return error.exitCode;
  }

  return null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Whether a failed ship request was a real 404. The api wraps a first-attempt
 * failure in BadResponseError, but its retry after a 403 reauth rejects with
 * the raw Response. Statusless (fetch-level) and other HTTP failures are not
 * answers and must surface as errors.
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof Response) return error.status === 404;
  return (
    error instanceof Error &&
    error.name === 'BadResponseError' &&
    (error as { status?: unknown }).status === 404
  );
}
