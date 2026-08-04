import type {
  MigrationDeps,
  MigrationOptions,
  MigrationPlan,
} from '../notes-migrate';
import { canonicalizeNest, parseNest } from '../notes-migrate';
import { type ApplySummary, executeApply } from '../notes-migrate-apply';
import { executePlan } from '../notes-migrate-plan';
import {
  type CommandDeps,
  commandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const MIGRATE_HELP = `Usage: tlon notes migrate-plan <diary-nest>
       tlon notes migrate-apply <diary-nest> --yes [--allow-write-widening]

Migrate a diary channel to a fresh %notes notebook.

Commands:
  migrate-plan   Complete read-only conversion plan
  migrate-apply  Create, import, verify, and archive (requires --yes)

Options:
  --allow-write-widening  Accept the reported editor-access widening
  --yes                   Confirm migrate-apply
`;

export interface MigrateCommandDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  migration: MigrationDeps;
}

export function parseMigrateArgs(
  subcommand: string,
  args: string[]
): MigrationOptions {
  if (subcommand !== 'migrate-plan' && subcommand !== 'migrate-apply') {
    throw usageError(
      subcommand === 'migrate'
        ? 'Use either migrate-plan or migrate-apply'
        : `Unknown migrate subcommand: ${subcommand}`,
      MIGRATE_HELP
    );
  }

  const allowed = new Set(
    subcommand === 'migrate-plan'
      ? ['allow-write-widening']
      : ['allow-write-widening', 'yes']
  );
  const seenFlags = new Set<string>();
  let sourceNest: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const flag = arg.slice(2);
      if (!allowed.has(flag)) {
        throw usageError(
          `Option --${flag} is not permitted for ${subcommand}`,
          MIGRATE_HELP
        );
      }
      if (seenFlags.has(flag)) {
        throw usageError(`Duplicate option --${flag}`, MIGRATE_HELP);
      }
      seenFlags.add(flag);
      continue;
    }
    if (sourceNest) {
      throw usageError(`Unexpected argument: ${arg}`, MIGRATE_HELP);
    }
    sourceNest = arg;
  }

  if (!sourceNest) {
    throw usageError('Missing required <diary-nest> argument', MIGRATE_HELP);
  }
  const canonical = canonicalizeNest(sourceNest);
  if (parseNest(canonical).kind !== 'diary') {
    throw commandError(`Expected a diary/... nest, got: ${sourceNest}`);
  }
  const yes = seenFlags.has('yes');
  if (subcommand === 'migrate-apply' && !yes) {
    throw commandError('migrate-apply requires --yes to confirm execution');
  }
  return {
    sourceNest: canonical,
    allowWriteWidening: seenFlags.has('allow-write-widening'),
    yes,
  };
}

function quoteRoles(roles: string[]): string {
  return roles.map((role) => `"${role}"`).join(', ');
}

function readerClass(
  access: Pick<MigrationPlan, 'readerRoles' | 'privacy'>
): string {
  if (access.readerRoles.length > 0) {
    return `members with ${quoteRoles(access.readerRoles)}`;
  }
  return access.privacy === 'public' ? 'anyone' : 'all group members';
}

function writerClass(plan: MigrationPlan): string {
  if (plan.writerRoles.length === 0) {
    return 'all group members can post';
  }
  return `${quoteRoles(plan.writerRoles)} can post`;
}

export function formatPlanText(plan: MigrationPlan): string {
  const lines = [
    `Migration plan — ${plan.sourceTitle}`,
    `${plan.sourceNest}  →  new notebook in ${plan.group}`,
    '',
    'WHAT MOVES',
    `  ${plan.eligibleCount} posts → ${plan.eligibleCount} notes`,
  ];
  if (plan.previewTitles.length > 0) {
    lines.push(
      `  First few: ${plan.previewTitles
        .map((title) => `"${title}"`)
        .join(' · ')}`
    );
  }
  lines.push(
    '',
    "WHAT DOESN'T MOVE  (stays readable in the archive)",
    `  ${plan.metrics.citeCount} post references and ${plan.metrics.linkBlockCount} link blocks — dropped in conversion`,
    `  ${plan.metrics.groupMentionCount} group mentions → converted to plain text`,
    `  ${plan.metrics.flattenedInlineCount} tags and inline references → converted to plain text`,
    `  ${plan.metrics.totalComments} comments and ${plan.metrics.totalReactions} post reactions — remain on the archived channel`,
    `  ${plan.tombstoneCount} tombstones and ${plan.stubCount} sequence stubs — not imported`,
    "  Reactions on comments aren't counted — replies aren't read",
    '  Post descriptions, covers and attachments: archive-only',
    '  Note order follows the import, not the original post dates',
    '',
    `AUTHORSHIP — every note will show ${parseNest(plan.sourceNest).host} as author, dated today.`,
    '  The notebook format cannot carry the original author or date.',
    '  Each note keeps a line naming its original author and date;',
    '  the true values remain on the archived channel.',
    '',
    `PERMISSIONS${plan.writeWidening ? ' — this widens write access' : ''}`,
    `  Now:   ${writerClass(plan)}; ${readerClass(plan)} can read.`,
    `  After: every member who can read the notebook can EDIT every note.`
  );
  if (plan.writeWidening) {
    for (const reason of plan.wideningReasons) {
      lines.push(`  - ${reason}`);
    }
    lines.push('  Blocked by default; requires explicit acceptance.');
  } else {
    lines.push('  No write-access widening detected.');
  }
  lines.push(
    '',
    'RESULT',
    `  New notebook "${plan.targetTitle}", readable by: ${readerClass(plan)}`,
    `  Original renamed "${plan.archiveTitle}" — nothing is deleted.`,
    '  The original stays WRITABLE; renaming does not close it.'
  );
  return lines.join('\n');
}

export function formatApplySummaryLines(summary: ApplySummary): string[] {
  return [
    'Migration complete.',
    `  Notes imported: ${summary.notesImported}`,
    `  Target: ${summary.targetNest}`,
    `  Archive title: ${summary.archiveTitle}${
      summary.archiveRenamed ? '' : ' (rename in the app)'
    }`,
    `  Left in archive: ${summary.archiveOnly.totalComments} comments, ${summary.archiveOnly.totalReactions} reactions, ${summary.archiveOnly.citeCount} references, ${summary.archiveOnly.linkBlockCount} link blocks`,
    `  Converted to plain text: ${summary.archiveOnly.groupMentionCount} group mentions, ${summary.archiveOnly.flattenedInlineCount} tags/inline references`,
    ...summary.warnings.map((warning) => `  Warning: ${warning}`),
  ];
}

export async function runMigratePlan(
  args: string[],
  deps: MigrateCommandDeps
): Promise<number> {
  if (isHelpArg(args[0])) return writeHelp(deps, MIGRATE_HELP);
  const options = parseMigrateArgs('migrate-plan', args);
  await deps.authenticate();
  const { plan } = await executePlan(options, deps.migration);
  writeLine(deps.stdout, formatPlanText(plan));
  return 0;
}

export async function runMigrateApply(
  args: string[],
  deps: MigrateCommandDeps
): Promise<number> {
  if (isHelpArg(args[0])) return writeHelp(deps, MIGRATE_HELP);
  const options = parseMigrateArgs('migrate-apply', args);
  await deps.authenticate();
  const { summary } = await executeApply(options, deps.migration);

  for (const line of formatApplySummaryLines(summary)) {
    writeLine(deps.stdout, line);
  }
  return 0;
}

export async function runMigrate(
  args: string[],
  deps: MigrateCommandDeps
): Promise<number> {
  const subcommand = args[0];
  if (!subcommand) {
    throw usageError('Use either migrate-plan or migrate-apply', MIGRATE_HELP);
  }
  if (isHelpArg(subcommand)) return writeHelp(deps, MIGRATE_HELP);
  const rest = args.slice(1);
  if (subcommand === 'migrate-plan') return runMigratePlan(rest, deps);
  if (subcommand === 'migrate-apply') return runMigrateApply(rest, deps);
  parseMigrateArgs(subcommand, rest);
  throw new Error('unreachable');
}
