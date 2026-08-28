import type { BucketsEntry, BucketsFlag, BucketsSnapshot } from '@tloncorp/api';
import { p } from '@urbit/aura';

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
  tlon buckets read buckets/~host/project-files 12

During the preview, delete supports empty folders only. File and recursive
deletion remain disabled until object storage and metadata deletion are atomic.`;

const HELP_BY_COMMAND: Record<string, string> = {
  list: 'Usage: tlon buckets list',
  show: 'Usage: tlon buckets show <buckets/~host/name>',
  files: 'Usage: tlon buckets files <buckets/~host/name> [--parent <id|root>]',
  search: 'Usage: tlon buckets search <buckets/~host/name> <query>',
  create:
    'Usage: tlon buckets create <~host/group> <title> [--name <slug>] [--readers <role,...>] [--writers <role,...>]',
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
    readers?: string[];
    writers?: string[];
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
  | {
      kind: 'create';
      group: BucketsFlag;
      title: string;
      name?: string;
      readers?: string[];
      writers?: string[];
    }
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
  const host = normalizeShip(rawHost);
  let hostKind: p.size;
  try {
    hostKind = p.kind(host);
  } catch {
    throw usageError(`Invalid group host: ${rawHost}.`, usage);
  }
  if (hostKind !== 'planet') {
    throw usageError(
      'Buckets are currently available only in groups hosted by a planet. Do not substitute a Moon owner or another member ship.',
      usage
    );
  }
  return { host, name };
}

function parseId(value: string | undefined, label: string, usage: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw usageError(`Invalid ${label}: ${value ?? '(missing)'}`, usage);
  }
  const parsed = Number.parseInt(value, 10);
  // All digits is not enough: past 2^53 the parse rounds to a different id,
  // and past ~309 digits it is Infinity, which JSON writes as null -- and a
  // null parent means the Bucket root, so mkdir, upload and move would
  // quietly put the entry somewhere the caller never named.
  if (!Number.isSafeInteger(parsed)) {
    throw usageError(`${label} is out of range: ${value}`, usage);
  }
  return parsed;
}

function parseParent(value: string | undefined, usage: string) {
  if (value === undefined || value === 'root') return null;
  return parseId(value, 'parent id', usage);
}

type OptionSpec = {
  key: string;
  names: string[];
  takesValue: boolean;
};

function parseOptions(
  args: string[],
  start: number,
  specs: OptionSpec[],
  usage: string
) {
  const parsed = new Map<string, string | true>();
  for (let index = start; index < args.length; index += 1) {
    const arg = args[index];
    const spec = specs.find((candidate) => candidate.names.includes(arg));
    if (!spec) throw usageError(`Unexpected argument: ${arg}`, usage);
    if (parsed.has(spec.key)) {
      throw usageError(`${spec.names[0]} may be given only once`, usage);
    }
    if (!spec.takesValue) {
      parsed.set(spec.key, true);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('-')) {
      throw usageError(`${arg} requires a value`, usage);
    }
    parsed.set(spec.key, value);
    index += 1;
  }
  return parsed;
}

function requireArgCount(args: string[], count: number, usage: string) {
  if (args.length !== count) {
    const unexpected = args[count];
    throw unexpected
      ? usageError(`Unexpected argument: ${unexpected}`, usage)
      : usageError(usage);
  }
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
      requireArgCount(args, 1, help);
      return { kind: 'list' };
    case 'show':
      requireArgCount(args, 2, help);
      return { kind: 'show', target: parseBucketNest(args[1], help) };
    case 'files': {
      if (!args[1]) throw usageError(help);
      const options = parseOptions(
        args,
        2,
        [{ key: 'parent', names: ['--parent'], takesValue: true }],
        help
      );
      return {
        kind: 'files',
        target: parseBucketNest(args[1], help),
        parentId: parseParent(
          options.get('parent') as string | undefined,
          help
        ),
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
      const optionIndex = args.findIndex(
        (arg, index) => index >= 2 && arg.startsWith('-')
      );
      const titleEnd = optionIndex === -1 ? args.length : optionIndex;
      const title = args.slice(2, titleEnd).join(' ').trim();
      if (!title) throw usageError(help);
      const options = parseOptions(
        args,
        titleEnd,
        [
          { key: 'name', names: ['--name'], takesValue: true },
          { key: 'readers', names: ['--readers'], takesValue: true },
          { key: 'writers', names: ['--writers'], takesValue: true },
        ],
        help
      );
      const name = options.get('name') as string | undefined;
      // Sent with the create rather than applied afterwards. Empty readers
      // mean every group member can read and empty writers mean every reader
      // can write, so a Bucket that is restricted in the end must never have
      // been open in the middle -- and if a follow-up call failed it would
      // stay open for good.
      const roleList = (key: string) => {
        const raw = options.get(key) as string | undefined;
        if (raw === undefined) return undefined;
        const roles = raw
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean);
        if (roles.length === 0) throw usageError(`--${key} needs a role`, help);
        return roles;
      };
      const readers = roleList('readers');
      const writers = roleList('writers');
      return {
        kind: 'create',
        group: parseGroup(args[1], help),
        title,
        ...(name ? { name } : {}),
        ...(readers ? { readers } : {}),
        ...(writers ? { writers } : {}),
      };
    }
    case 'mkdir': {
      if (!args[1] || !args[2]) throw usageError(help);
      const options = parseOptions(
        args,
        3,
        [{ key: 'parent', names: ['--parent'], takesValue: true }],
        help
      );
      return {
        kind: 'mkdir',
        target: parseBucketNest(args[1], help),
        name: args[2],
        parentId: parseParent(
          options.get('parent') as string | undefined,
          help
        ),
      };
    }
    case 'upload': {
      if (!args[1] || !args[2]) throw usageError(help);
      const options = parseOptions(
        args,
        3,
        [
          { key: 'parent', names: ['--parent'], takesValue: true },
          { key: 'name', names: ['--name'], takesValue: true },
          { key: 'mime', names: ['-t', '--type'], takesValue: true },
        ],
        help
      );
      const parent = options.get('parent') as string | undefined;
      const name = options.get('name') as string | undefined;
      const mime = options.get('mime') as string | undefined;
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
      requireArgCount(args, 3, help);
      return {
        kind: 'read',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'file id', help),
      };
    case 'rename':
      requireArgCount(args, 4, help);
      return {
        kind: 'rename',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'entry id', help),
        name: args[3],
      };
    case 'move':
      requireArgCount(args, 4, help);
      return {
        kind: 'move',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'entry id', help),
        parentId: parseParent(args[3], help),
      };
    case 'delete': {
      if (!args[1] || !args[2]) throw usageError(help);
      const options = parseOptions(
        args,
        3,
        [{ key: 'recursive', names: ['--recursive'], takesValue: false }],
        help
      );
      return {
        kind: 'delete',
        target: parseBucketNest(args[1], help),
        id: parseId(args[2], 'entry id', help),
        recursive: options.has('recursive'),
      };
    }
    case 'set-writers':
      if (!args[1]) throw usageError(help);
      for (const writer of args.slice(2)) {
        if (writer.startsWith('-')) {
          throw usageError(`Unexpected argument: ${writer}`, help);
        }
      }
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
              ...(parsed.readers ? { readers: parsed.readers } : {}),
              ...(parsed.writers ? { writers: parsed.writers } : {}),
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
