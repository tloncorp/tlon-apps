import type { BucketsEntry, BucketsFlag, BucketsSnapshot } from '@tloncorp/api';

import {
  type CommandDeps,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const BUCKETS_HELP = `Usage: tlon buckets <command>

Work with shared %buckets channels. Bucket authorization comes from the
current ship's group membership and roles; S3 or owner credentials are never
accepted by these commands.

Commands:
  list
  show <buckets/~host/name>
  files <buckets/~host/name> [--parent <id|root>]
  search <buckets/~host/name> <query>
  create <~host/group> <title> [--name <slug>]
  mkdir <buckets/~host/name> <folder-name> [--parent <id|root>]
  upload <buckets/~host/name> <local-file> [--parent <id|root>] [--name <filename>] [-t <mime>]
  read <buckets/~host/name> <file-id>
  rename <buckets/~host/name> <entry-id> <new-name>
  move <buckets/~host/name> <entry-id> <parent-id|root>
  delete <buckets/~host/name> <entry-id> [--recursive]
  set-writers <buckets/~host/name> [role ...]

Examples:
  tlon buckets list
  tlon buckets files buckets/~host/project-files --parent root
  tlon buckets upload buckets/~host/project-files ./plan.md -t text/markdown
  tlon buckets read buckets/~host/project-files 12`;

const HELP_BY_COMMAND: Record<string, string> = {
  list: 'Usage: tlon buckets list',
  show: 'Usage: tlon buckets show <buckets/~host/name>',
  files: 'Usage: tlon buckets files <buckets/~host/name> [--parent <id|root>]',
  search: 'Usage: tlon buckets search <buckets/~host/name> <query>',
  create: 'Usage: tlon buckets create <~host/group> <title> [--name <slug>]',
  mkdir:
    'Usage: tlon buckets mkdir <buckets/~host/name> <folder-name> [--parent <id|root>]',
  upload:
    'Usage: tlon buckets upload <buckets/~host/name> <local-file> [--parent <id|root>] [--name <filename>] [-t <mime>]',
  read: 'Usage: tlon buckets read <buckets/~host/name> <file-id>',
  rename:
    'Usage: tlon buckets rename <buckets/~host/name> <entry-id> <new-name>',
  move: 'Usage: tlon buckets move <buckets/~host/name> <entry-id> <parent-id|root>',
  delete:
    'Usage: tlon buckets delete <buckets/~host/name> <entry-id> [--recursive]',
  'set-writers':
    'Usage: tlon buckets set-writers <buckets/~host/name> [role ...]',
};

export type BucketTarget = {
  flag: BucketsFlag;
  nest: string;
};

export interface BucketsOperations {
  list(): Promise<unknown[]>;
  show(target: BucketTarget): Promise<BucketsSnapshot>;
  files(target: BucketTarget, parentId: number | null): Promise<BucketsEntry[]>;
  search(target: BucketTarget, query: string): Promise<unknown[]>;
  create(input: {
    group: BucketsFlag;
    title: string;
    name?: string;
  }): Promise<{ nest: string }>;
  createFolder(input: {
    target: BucketTarget;
    parentId: number | null;
    name: string;
  }): Promise<unknown>;
  upload(input: {
    target: BucketTarget;
    filePath: string;
    parentId: number | null;
    name?: string;
    mime?: string;
  }): Promise<unknown>;
  read(target: BucketTarget, id: number): Promise<string>;
  rename(target: BucketTarget, id: number, name: string): Promise<unknown>;
  move(
    target: BucketTarget,
    id: number,
    parentId: number | null
  ): Promise<unknown>;
  delete(
    target: BucketTarget,
    id: number,
    recursive: boolean
  ): Promise<unknown>;
  setWriters(target: BucketTarget, writers: string[]): Promise<unknown>;
}

export interface BucketsDeps extends CommandDeps {
  authenticate(): Promise<void>;
  buckets: BucketsOperations;
}

type ParsedArgs =
  | { kind: 'help'; help: string }
  | { kind: 'list' }
  | { kind: 'show'; target: BucketTarget }
  | { kind: 'files'; target: BucketTarget; parentId: number | null }
  | { kind: 'search'; target: BucketTarget; query: string }
  | { kind: 'create'; group: BucketsFlag; title: string; name?: string }
  | {
      kind: 'mkdir';
      target: BucketTarget;
      parentId: number | null;
      name: string;
    }
  | {
      kind: 'upload';
      target: BucketTarget;
      filePath: string;
      parentId: number | null;
      name?: string;
      mime?: string;
    }
  | { kind: 'read'; target: BucketTarget; id: number }
  | { kind: 'rename'; target: BucketTarget; id: number; name: string }
  | {
      kind: 'move';
      target: BucketTarget;
      id: number;
      parentId: number | null;
    }
  | {
      kind: 'delete';
      target: BucketTarget;
      id: number;
      recursive: boolean;
    }
  | { kind: 'set-writers'; target: BucketTarget; writers: string[] };

function normalizeShip(ship: string): string {
  const normalized = ship.trim().toLowerCase();
  return normalized.startsWith('~') ? normalized : `~${normalized}`;
}

export function parseBucketNest(nest: string, usage: string): BucketTarget {
  const [kind, rawHost, name, ...rest] = nest.split('/');
  if (
    kind !== 'buckets' ||
    !rawHost ||
    !name ||
    rest.length > 0 ||
    !/^~?[a-z-]+$/i.test(rawHost)
  ) {
    throw usageError(
      `Invalid Bucket nest: ${nest}. Expected buckets/~host/name.`,
      usage
    );
  }
  const host = normalizeShip(rawHost);
  return { flag: { host, name }, nest: `buckets/${host}/${name}` };
}

function parseGroup(group: string, usage: string): BucketsFlag {
  const [rawHost, name, ...rest] = group.split('/');
  if (!rawHost || !name || rest.length > 0 || !/^~?[a-z-]+$/i.test(rawHost)) {
    throw usageError(`Invalid group id: ${group}. Expected ~host/name.`, usage);
  }
  return { host: normalizeShip(rawHost), name };
}

function parseId(value: string | undefined, label: string, usage: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw usageError(`Invalid ${label}: ${value ?? '(missing)'}`, usage);
  }
  return Number.parseInt(value, 10);
}

function parseParent(value: string | undefined, usage: string) {
  if (value === undefined || value === 'root') return null;
  return parseId(value, 'parent id', usage);
}

function optionValue(
  args: string[],
  flags: string[],
  usage: string
): string | undefined {
  const indexes = args
    .map((arg, index) => (flags.includes(arg) ? index : -1))
    .filter((index) => index >= 0);
  if (indexes.length > 1) {
    throw usageError(`${flags[0]} may be given only once`, usage);
  }
  if (indexes.length === 0) return undefined;
  const value = args[indexes[0] + 1];
  if (!value || value.startsWith('--')) {
    throw usageError(`${args[indexes[0]]} requires a value`, usage);
  }
  return value;
}

function hasHelp(args: string[]) {
  return args.some(isHelpArg);
}

function parseArgs(args: string[]): ParsedArgs {
  const command = args[0];
  if (isHelpArg(command)) return { kind: 'help', help: BUCKETS_HELP };
  if (command && hasHelp(args.slice(1))) {
    return { kind: 'help', help: HELP_BY_COMMAND[command] ?? BUCKETS_HELP };
  }
  const help = command ? HELP_BY_COMMAND[command] : undefined;
  if (!command || !help) throw usageError(BUCKETS_HELP);

  switch (command) {
    case 'list':
      return { kind: 'list' };
    case 'show':
      if (!args[1]) throw usageError(help);
      return { kind: 'show', target: parseBucketNest(args[1], help) };
    case 'files': {
      if (!args[1]) throw usageError(help);
      const parent = optionValue(args, ['--parent'], help);
      return {
        kind: 'files',
        target: parseBucketNest(args[1], help),
        parentId: parseParent(parent, help),
      };
    }
    case 'search': {
      if (!args[1] || !args[2]) throw usageError(help);
      return {
        kind: 'search',
        target: parseBucketNest(args[1], help),
        query: args.slice(2).join(' '),
      };
    }
    case 'create': {
      if (!args[1] || !args[2]) throw usageError(help);
      const name = optionValue(args, ['--name'], help);
      const optionIndex = args.indexOf('--name');
      const titleEnd = optionIndex === -1 ? args.length : optionIndex;
      const title = args.slice(2, titleEnd).join(' ').trim();
      if (!title) throw usageError(help);
      return {
        kind: 'create',
        group: parseGroup(args[1], help),
        title,
        ...(name ? { name } : {}),
      };
    }
    case 'mkdir': {
      if (!args[1] || !args[2]) throw usageError(help);
      const parent = optionValue(args, ['--parent'], help);
      return {
        kind: 'mkdir',
        target: parseBucketNest(args[1], help),
        name: args[2],
        parentId: parseParent(parent, help),
      };
    }
    case 'upload': {
      if (!args[1] || !args[2]) throw usageError(help);
      const parent = optionValue(args, ['--parent'], help);
      const name = optionValue(args, ['--name'], help);
      const mime = optionValue(args, ['-t', '--type'], help);
      return {
        kind: 'upload',
        target: parseBucketNest(args[1], help),
        filePath: args[2],
        parentId: parseParent(parent, help),
        ...(name ? { name } : {}),
        ...(mime ? { mime } : {}),
      };
    }
    case 'read':
      if (!args[1]) throw usageError(help);
      return {
        kind: 'read',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'file id', help),
      };
    case 'rename':
      if (!args[1] || !args[3]) throw usageError(help);
      return {
        kind: 'rename',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'entry id', help),
        name: args[3],
      };
    case 'move':
      if (!args[1] || !args[3]) throw usageError(help);
      return {
        kind: 'move',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'entry id', help),
        parentId: parseParent(args[3], help),
      };
    case 'delete':
      if (!args[1]) throw usageError(help);
      return {
        kind: 'delete',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'entry id', help),
        recursive: args.includes('--recursive'),
      };
    case 'set-writers':
      if (!args[1]) throw usageError(help);
      return {
        kind: 'set-writers',
        target: parseBucketNest(args[1], help),
        writers: args.slice(2),
      };
    default:
      throw usageError(BUCKETS_HELP);
  }
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export async function run(args: string[], deps: BucketsDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);
    if (parsed.kind === 'help') return writeHelp(deps, parsed.help);

    await deps.authenticate();
    switch (parsed.kind) {
      case 'list':
        writeLine(deps.stdout, json(await deps.buckets.list()));
        break;
      case 'show':
        writeLine(deps.stdout, json(await deps.buckets.show(parsed.target)));
        break;
      case 'files':
        writeLine(
          deps.stdout,
          json(await deps.buckets.files(parsed.target, parsed.parentId))
        );
        break;
      case 'search':
        writeLine(
          deps.stdout,
          json(await deps.buckets.search(parsed.target, parsed.query))
        );
        break;
      case 'create':
        writeLine(
          deps.stdout,
          json(
            await deps.buckets.create({
              group: parsed.group,
              title: parsed.title,
              ...(parsed.name ? { name: parsed.name } : {}),
            })
          )
        );
        break;
      case 'mkdir':
        writeLine(
          deps.stdout,
          json(
            await deps.buckets.createFolder({
              target: parsed.target,
              parentId: parsed.parentId,
              name: parsed.name,
            })
          )
        );
        break;
      case 'upload':
        writeLine(deps.stdout, json(await deps.buckets.upload(parsed)));
        break;
      case 'read':
        writeLine(
          deps.stdout,
          await deps.buckets.read(parsed.target, parsed.id)
        );
        break;
      case 'rename':
        writeLine(
          deps.stdout,
          json(await deps.buckets.rename(parsed.target, parsed.id, parsed.name))
        );
        break;
      case 'move':
        writeLine(
          deps.stdout,
          json(
            await deps.buckets.move(parsed.target, parsed.id, parsed.parentId)
          )
        );
        break;
      case 'delete':
        writeLine(
          deps.stdout,
          json(
            await deps.buckets.delete(
              parsed.target,
              parsed.id,
              parsed.recursive
            )
          )
        );
        break;
      case 'set-writers':
        writeLine(
          deps.stdout,
          json(await deps.buckets.setWriters(parsed.target, parsed.writers))
        );
        break;
    }
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
