import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { hasAmbiguousMigrationAccount } from './migration-account-safety.js';
import {
  type CommandContextLike,
  resolveBridgeForCommand,
} from './monitor/command-auth.js';
import type {
  ApprovalCommandBridge,
  TlonCommandCredentials,
} from './monitor/command-bridge.js';
import {
  type BuildMigrateCard,
  buildMigrateCard,
} from './monitor/migrate-card.js';
import { sharedMap } from './shared-state.js';
import { canonicalizeNest, normalizeShip } from './targets.js';
import { formatTlonTelemetryErrorText, reportMigration } from './telemetry.js';
import type { TlonCommandDeadlineOutput } from './tlon-command-runner.js';

export const MIGRATION_APPLY_TIMEOUT_MS = 30 * 60_000;
export const MIGRATION_CLEANUP_TIMEOUT_MS = 2 * 60_000;
export const MIGRATION_SINGLE_ACCOUNT_REQUIRED =
  'Migration requires a single-account configuration. Disable additional Tlon accounts before using /migrate.';
export const MIGRATION_DROP_WARNING =
  'Before any write: comments, reactions, post references, and link blocks stay on the archived channel and are not copied. ' +
  'Post descriptions, covers, and attachments also stay in the archive and are not copied. ' +
  'Group mentions become plain text. Every migrated note will show the acting ship as its author, regardless of who wrote the original. ' +
  'Migrated notes are dated at import time. Note order follows the import, not the original post dates. ' +
  'The source channel stays intact, remains writable, and is renamed with an `-ARCHIVE` suffix.';

type Credentials = TlonCommandCredentials;
type CredentialKind = 'bot-hosted' | 'owner-hosted';

type ParsedMigrateCommand =
  | { kind: 'migrate'; nest: string; allowWriteWidening: boolean }
  | { kind: 'cleanup'; nest: string };

type CredentialSelection =
  | {
      kind: CredentialKind;
      prefixArgs: string[];
      credentials: Credentials | undefined;
    }
  | { error: string };

export type MigrateCommandDeps = {
  runCommand: (
    args: string[],
    credentials: Credentials | undefined,
    timeoutMs: number,
    onDeadline?: (output: TlonCommandDeadlineOutput) => void
  ) => Promise<string>;
  env?: NodeJS.ProcessEnv;
  fileExists?: (path: string) => boolean;
  spawnTask?: (task: () => Promise<void>) => void;
  logError?: (message: string) => void;
  buildMigrateCard?: BuildMigrateCard;
  applyInFlight?: Map<string, Promise<void>>;
  cleanupInFlight?: Map<string, Promise<void>>;
};

const processApplyInFlight = sharedMap<string, Promise<void>>(
  'migrate-command.apply-in-flight'
);
const processCleanupInFlight = sharedMap<string, Promise<void>>(
  'migrate-command.cleanup-in-flight'
);

const MIGRATE_USAGE =
  'Usage: /migrate <diary-nest> [--allow-write-widening] | ' +
  '/migrate cleanup <notes-nest>';
// These three are string contracts with the `tlon` CLI, matched against its
// output to classify a failure. Nothing on either side pins them, so rewording
// the CLI message silently degrades this runtime to its generic handling — for
// the partial-cleanup marker specifically, that means telling an owner to go
// delete a notebook that no longer exists. Emission sites, all in
// `packages/tlon-skill/scripts`:
//   CREATE_FAILURE_MARKER          notes-migrate-runtime.ts (create failure text)
//   UNMARKED_NOTES_REFUSAL_MARKER  commands/notes.ts, provenance safety gate
//   PARTIAL_CLEANUP_MARKER         commands/notes.ts, `runNotebookDelete`
const CREATE_FAILURE_MARKER = 'Notebook creation may or may not have landed.';
const UNMARKED_NOTES_REFUSAL_MARKER =
  'without a tlon-migrate provenance footer';
// Deliberately only the shared prefix: the CLI emits two variants that diverge
// after the nest ("still present" vs "could not be checked").
const PARTIAL_CLEANUP_MARKER = 'Notebook deleted; group cleanup unconfirmed';

function parseCanonicalNest(
  raw: string,
  expectedPrefix: 'diary' | 'notes'
): string | null {
  if (expectedPrefix === 'diary') {
    const canonical = canonicalizeNest(raw);
    return canonical?.startsWith('diary/') ? canonical : null;
  }
  const parts = raw.trim().split('/');
  if (
    parts.length !== 3 ||
    parts[0]?.toLowerCase() !== 'notes' ||
    !parts[1] ||
    !parts[2]
  ) {
    return null;
  }
  return `notes/${normalizeShip(parts[1])}/${parts[2]}`;
}

function parseOptionalWideningFlag(
  args: string[]
): { allowWriteWidening: boolean } | null {
  if (args.length === 0) return { allowWriteWidening: false };
  if (args.length === 1 && args[0] === '--allow-write-widening') {
    return { allowWriteWidening: true };
  }
  return null;
}

export function parseMigrateCommand(
  rawArgs: string | undefined
): ParsedMigrateCommand | { error: string } {
  const args = (rawArgs ?? '').trim().split(/\s+/).filter(Boolean);
  const action = args[0]?.toLowerCase();
  if (!action) return { error: MIGRATE_USAGE };

  if (action === 'cleanup') {
    const nest = parseCanonicalNest(args[1] ?? '', 'notes');
    return args.length === 2 && nest
      ? { kind: 'cleanup', nest }
      : { error: MIGRATE_USAGE };
  }

  const nest = parseCanonicalNest(args[0] ?? '', 'diary');
  const rest = args.slice(1);
  const options = parseOptionalWideningFlag(rest);
  if (!nest || !options) return { error: MIGRATE_USAGE };
  return { kind: 'migrate', nest, ...options };
}

function selectCredentials(
  nest: string,
  bridge: Pick<
    ApprovalCommandBridge,
    'botCredentials' | 'botShip' | 'ownerShip'
  >,
  deps: MigrateCommandDeps
): CredentialSelection {
  const host = normalizeShip(nest.split('/')[1] ?? '');
  const botShip = normalizeShip(bridge.botShip ?? '');
  const ownerShip = normalizeShip(bridge.ownerShip ?? '');
  if (host && host === botShip) {
    return {
      kind: 'bot-hosted',
      prefixArgs: [],
      credentials: bridge.botCredentials,
    };
  }
  if (host && host === ownerShip) {
    const skillDir = String(
      (deps.env ?? process.env).TLON_SKILL_DIR ?? ''
    ).trim();
    if (!skillDir) {
      return {
        error: `Migration for host ${host} requires TLON_SKILL_DIR so the owner credential file can be located.`,
      };
    }
    const configPath = join(
      skillDir,
      'ships',
      `${ownerShip.replace(/^~/, '')}.json`
    );
    if (!(deps.fileExists ?? existsSync)(configPath)) {
      return {
        error: `Migration for host ${host} requires owner credentials at ${configPath}.`,
      };
    }
    return {
      kind: 'owner-hosted',
      prefixArgs: ['--config', configPath],
      credentials: undefined,
    };
  }
  return {
    error: `Migration cannot run for host ${host || '(unknown)'}. It must run from the ship that hosts the diary.`,
  };
}

function errorFields(error: unknown): {
  message: string;
  stdout: string;
  stderr: string;
} {
  const candidate =
    error && typeof error === 'object'
      ? (error as {
          message?: unknown;
          stdout?: unknown;
          stderr?: unknown;
        })
      : {};
  return {
    message:
      typeof candidate.message === 'string' ? candidate.message : String(error),
    stdout: typeof candidate.stdout === 'string' ? candidate.stdout : '',
    stderr: typeof candidate.stderr === 'string' ? candidate.stderr : '',
  };
}

function targetNestFrom(text: string): string | null {
  const created = text.match(
    /^Target notebook created: (notes\/~[a-z-]+\/[a-zA-Z0-9-]+)[ \t]*\r?$/m
  )?.[1];
  if (created) return created;
  return (
    text.match(
      /\btlon notes notebook-delete (notes\/~[a-z-]+\/[a-zA-Z0-9-]+) --yes\b/
    )?.[1] ?? null
  );
}

function targetNestFromError(error: unknown): string | null {
  const fields = errorFields(error);
  return targetNestFrom(
    `${fields.stdout}\n${fields.stderr}\n${fields.message}`
  );
}

function isWriteWideningRefusal(error: unknown): boolean {
  const fields = errorFields(error);
  return `${fields.stdout}\n${fields.stderr}\n${fields.message}`.includes(
    '--allow-write-widening'
  );
}

function isUnmarkedNotesRefusal(error: unknown): boolean {
  const fields = errorFields(error);
  return `${fields.stdout}\n${fields.stderr}\n${fields.message}`.includes(
    UNMARKED_NOTES_REFUSAL_MARKER
  );
}

function isPartialCleanup(error: unknown): boolean {
  const fields = errorFields(error);
  return `${fields.stdout}\n${fields.stderr}\n${fields.message}`.includes(
    PARTIAL_CLEANUP_MARKER
  );
}

function stripCliRecovery(text: string): string {
  const known = text.indexOf('\nThe target notebook exists.');
  if (known >= 0) return text.slice(0, known).trimEnd();
  const createFailure = text.indexOf(`\n${CREATE_FAILURE_MARKER}`);
  return createFailure >= 0
    ? text.slice(0, createFailure).trimEnd()
    : text.trimEnd();
}

export function formatMigrationCommandFailure(
  error: unknown,
  credentialKind: CredentialKind
): string {
  const fields = errorFields(error);
  const errorText = fields.stderr || fields.message;
  const combined = `${fields.stdout}\n${errorText}`;
  const targetNest = targetNestFrom(combined);
  const base = stripCliRecovery(errorText);
  const captured = fields.stdout
    ? `Captured migration output:\n${fields.stdout.trimEnd()}\n\n`
    : '';

  if (targetNest) {
    const recovery = `Reply \`/migrate cleanup ${targetNest}\`, then run \`/migrate\` again.`;
    return `${captured}${base}\n\nThe target notebook exists. ${recovery}`;
  }
  if (combined.includes(CREATE_FAILURE_MARKER)) {
    const recovery =
      credentialKind === 'bot-hosted'
        ? `${CREATE_FAILURE_MARKER} Look for a notebook with the requested title in the bot ship’s Notes web UI and remove it before retrying.`
        : `${CREATE_FAILURE_MARKER} Look for a notebook with the requested title in your Notes app and remove it before retrying.`;
    return `${captured}${base}\n\n${recovery}`.trim();
  }
  if (!fields.stdout) return base;
  return `${captured}${base}`.trim();
}

export function createMigrateCommandHandler(deps: MigrateCommandDeps) {
  const buildCard = deps.buildMigrateCard ?? buildMigrateCard;
  const applyInFlight = deps.applyInFlight ?? processApplyInFlight;
  const cleanupInFlight = deps.cleanupInFlight ?? processCleanupInFlight;
  const spawnTask =
    deps.spawnTask ??
    ((task: () => Promise<void>) => {
      setTimeout(() => {
        void task().catch((error) => {
          deps.logError?.(`Migration background task failed: ${String(error)}`);
        });
      }, 0);
    });

  async function sendOwnerNotification(
    bridge: ApprovalCommandBridge,
    message: string,
    nest: string,
    recoveryCommand?: string,
    blob?: string
  ): Promise<boolean> {
    try {
      const messageId =
        blob === undefined
          ? await bridge.sendOwnerNotification(message)
          : await bridge.sendOwnerNotification(message, blob);
      if (messageId) return true;
      const targetNest = targetNestFrom(message) ?? nest;
      deps.logError?.(
        `Failed to send owner migration notification (target nest: ${targetNest})` +
          (recoveryCommand ? `; recovery command: ${recoveryCommand}` : '') +
          `. Undelivered message: ${message}`
      );
    } catch (error) {
      const targetNest = targetNestFrom(message) ?? nest;
      deps.logError?.(
        `Failed to send owner migration notification (target nest: ${targetNest})` +
          (recoveryCommand ? `; recovery command: ${recoveryCommand}` : '') +
          `: ${String(error)}. Undelivered message: ${message}`
      );
    }
    return false;
  }

  async function sendOwnerActionNotification(
    bridge: ApprovalCommandBridge,
    message: string,
    nest: string,
    command?: string,
    recoveryCommand = command
  ): Promise<void> {
    if (!command) {
      await sendOwnerNotification(bridge, message, nest, recoveryCommand);
      return;
    }
    let blob: string;
    try {
      blob = buildCard(command);
    } catch (error) {
      deps.logError?.(`Failed to build migration A2UI card: ${String(error)}`);
      await sendOwnerNotification(bridge, message, nest, recoveryCommand);
      return;
    }
    await sendOwnerNotification(bridge, message, nest, recoveryCommand, blob);
  }

  async function reportMigrationDeadline(
    bridge: ApprovalCommandBridge,
    nest: string,
    output: TlonCommandDeadlineOutput
  ): Promise<void> {
    const targetNest = targetNestFrom(`${output.stdout}\n${output.stderr}`);
    const targetDetail = targetNest
      ? ` The target notebook reported so far is \`${targetNest}\`; inspect that notebook in the Notes app after the migration finishes.`
      : '';
    const message =
      'No migration result has arrived yet. The migration may still be running. ' +
      `Do not retry it while it is still running.${targetDetail}`;
    await sendOwnerNotification(bridge, message, nest);
  }

  return async function handleMigrateCommand(
    bridge: ApprovalCommandBridge,
    rawArgs: string | undefined
  ): Promise<string> {
    const parsed = parseMigrateCommand(rawArgs);
    if ('error' in parsed) return parsed.error;
    const selection = selectCredentials(parsed.nest, bridge, deps);
    if ('error' in selection) return selection.error;

    if (parsed.kind === 'migrate') {
      // This deliberately blocks unrelated applies behind any cleanup. The
      // cleanup's two-minute deadline is advisory: its onDeadline callback
      // reports without killing the process, so a stuck cleanup blocks every
      // apply until the gateway restarts. That tradeoff is accepted for the
      // one-owner, one-notebook deployment.
      if (cleanupInFlight.size > 0) {
        const message =
          'A migration cleanup is currently running. Wait for it to finish, then retry the migration.';
        await sendOwnerNotification(bridge, message, parsed.nest);
        return message;
      }

      const inFlightKey = parsed.nest;
      const pending = applyInFlight.get(inFlightKey);
      if (pending) {
        const message = `A migration for ${parsed.nest} is already running.`;
        await sendOwnerNotification(bridge, message, parsed.nest);
        return message;
      }

      // Minted before the in-flight entry so a throw cannot strand the guard.
      const migrationId = randomUUID();
      let settleTask!: () => void;
      const task = new Promise<void>((resolve) => {
        settleTask = resolve;
      });
      applyInFlight.set(inFlightKey, task);
      spawnTask(async () => {
        let deadlineNotification: Promise<void> | undefined;
        let deadlineReported = false;
        const args = [
          ...selection.prefixArgs,
          'notes',
          'migrate-apply',
          parsed.nest,
          '--yes',
          ...(parsed.allowWriteWidening ? ['--allow-write-widening'] : []),
        ];
        reportMigration({
          migrationEvent: 'started',
          action: 'apply',
          migrationId,
          durationMs: null,
          deadlineExceeded: null,
          errorText: null,
        });
        const startedAt = performance.now();
        try {
          const output = await deps.runCommand(
            args,
            selection.credentials,
            MIGRATION_APPLY_TIMEOUT_MS,
            (output) => {
              deadlineReported = true;
              deadlineNotification = reportMigrationDeadline(
                bridge,
                parsed.nest,
                output
              ).catch(() => undefined);
            }
          );
          reportMigration({
            migrationEvent: 'completed',
            action: 'apply',
            migrationId,
            durationMs: Math.round(performance.now() - startedAt),
            deadlineExceeded: deadlineReported,
            errorText: null,
          });
          await deadlineNotification;
          await sendOwnerNotification(bridge, output, parsed.nest);
        } catch (error) {
          const durationMs = Math.round(performance.now() - startedAt);
          let message = formatMigrationCommandFailure(error, selection.kind);
          const targetNest = targetNestFromError(error);
          let actionCommand = targetNest
            ? `/migrate cleanup ${targetNest}`
            : undefined;
          const wideningOffer =
            !actionCommand &&
            !targetNest &&
            !parsed.allowWriteWidening &&
            isWriteWideningRefusal(error);
          if (wideningOffer) {
            actionCommand = `/migrate ${parsed.nest} --allow-write-widening`;
            message +=
              `\n\nReply \`${actionCommand}\` to accept that every reader ` +
              'will become an editor and proceed.';
          }
          // A consent refusal is terminal but not a failure: the owner is
          // expected to accept and re-run, so counting it as failed would
          // halve the success rate of a correctly working flow.
          reportMigration(
            wideningOffer
              ? {
                  migrationEvent: 'consent_required',
                  action: 'apply',
                  migrationId,
                  durationMs,
                  deadlineExceeded: deadlineReported,
                  errorText: null,
                }
              : {
                  migrationEvent: 'failed',
                  action: 'apply',
                  migrationId,
                  durationMs,
                  deadlineExceeded: deadlineReported,
                  errorText: formatTlonTelemetryErrorText(error),
                }
          );
          await deadlineNotification;
          await sendOwnerActionNotification(
            bridge,
            message,
            parsed.nest,
            actionCommand
          );
        } finally {
          if (applyInFlight.get(inFlightKey) === task) {
            applyInFlight.delete(inFlightKey);
          }
          settleTask();
        }
      });
      return `Migration started for ${parsed.nest}. I’ll DM the result.\n\n${MIGRATION_DROP_WARNING}`;
    }

    if (applyInFlight.size > 0) {
      const message =
        'A migration is currently running. Wait for it to finish, then retry the cleanup.';
      await sendOwnerNotification(bridge, message, parsed.nest);
      return message;
    }

    const inFlightKey = parsed.nest;
    const pending = cleanupInFlight.get(inFlightKey);
    if (pending) {
      const message = `A migration cleanup for ${parsed.nest} is already running.`;
      await sendOwnerNotification(
        bridge,
        message,
        parsed.nest,
        `/migrate cleanup ${parsed.nest}`
      );
      return message;
    }

    // Minted before the in-flight entry so a throw cannot strand the guard.
    const migrationId = randomUUID();
    let settleTask!: () => void;
    const task = new Promise<void>((resolve) => {
      settleTask = resolve;
    });
    cleanupInFlight.set(inFlightKey, task);
    spawnTask(async () => {
      let deadlineNotification: Promise<void> | undefined;
      let deadlineReported = false;
      reportMigration({
        migrationEvent: 'started',
        action: 'cleanup',
        migrationId,
        durationMs: null,
        deadlineExceeded: null,
        errorText: null,
      });
      const startedAt = performance.now();
      try {
        const output = await deps.runCommand(
          [
            ...selection.prefixArgs,
            'notes',
            'notebook-delete',
            parsed.nest,
            '--yes',
          ],
          selection.credentials,
          MIGRATION_CLEANUP_TIMEOUT_MS,
          (output) => {
            deadlineReported = true;
            deadlineNotification = reportMigrationDeadline(
              bridge,
              parsed.nest,
              output
            ).catch(() => undefined);
          }
        );
        reportMigration({
          migrationEvent: 'completed',
          action: 'cleanup',
          migrationId,
          durationMs: Math.round(performance.now() - startedAt),
          deadlineExceeded: deadlineReported,
          errorText: null,
        });
        await deadlineNotification;
        await sendOwnerNotification(bridge, output, parsed.nest);
      } catch (error) {
        const durationMs = Math.round(performance.now() - startedAt);
        // A partial cleanup deleted the notebook (only the group-listing
        // check was unconfirmed), so it counts as completed.
        reportMigration(
          isPartialCleanup(error)
            ? {
                migrationEvent: 'completed',
                action: 'cleanup',
                migrationId,
                durationMs,
                deadlineExceeded: deadlineReported,
                errorText: null,
              }
            : {
                migrationEvent: 'failed',
                action: 'cleanup',
                migrationId,
                durationMs,
                deadlineExceeded: deadlineReported,
                errorText: formatTlonTelemetryErrorText(error),
              }
        );
        await deadlineNotification;
        // No card and no recovery command: the notebook is gone, so there is
        // nothing to clean up, and the diary nest needed to re-run the
        // migration is not derivable from a cleanup invocation.
        if (isPartialCleanup(error)) {
          const message =
            `The notebook \`${parsed.nest}\` was deleted successfully. ` +
            'The channel may still show in your group for a moment. ' +
            'Wait a few seconds, then retry the migration.';
          await sendOwnerNotification(bridge, message, parsed.nest);
          return;
        }
        const targetNest = targetNestFromError(error);
        const unmarkedNotesRefusal = isUnmarkedNotesRefusal(error);
        // The CLI refuses on notes lacking a `tlon-migrate` footer, which covers
        // notes added since the migration AND migrated notes whose body was
        // later edited — an edit replaces the body and takes the footer with it.
        // Saying the migration "did not create" them is wrong in the second,
        // likelier case, and sends the owner looking for the wrong thing.
        let message = unmarkedNotesRefusal
          ? `Migration cleanup stopped. The notebook \`${targetNest ?? parsed.nest}\` contains notes that were added or edited since the migration. ` +
            'Inspect it in the Notes app and delete it there if that is what you want.'
          : `Migration cleanup failed.\n\n${formatMigrationCommandFailure(error, selection.kind)}`;
        if (!unmarkedNotesRefusal && !targetNest) {
          message +=
            `\n\nInspect the notebook \`${parsed.nest}\` in the Notes app ` +
            'and delete it there if that is what you want.';
        }
        const actionCommand =
          !unmarkedNotesRefusal && targetNest
            ? `/migrate cleanup ${targetNest}`
            : undefined;
        await sendOwnerActionNotification(
          bridge,
          message,
          parsed.nest,
          actionCommand,
          unmarkedNotesRefusal ? undefined : `/migrate cleanup ${parsed.nest}`
        );
      } finally {
        if (cleanupInFlight.get(inFlightKey) === task) {
          cleanupInFlight.delete(inFlightKey);
        }
        settleTask();
      }
    });
    return `Cleanup started for ${parsed.nest}. I’ll DM the result.`;
  };
}

export async function routeMigrateCommand(
  ctx: CommandContextLike,
  rawArgs: string | undefined,
  handleMigrateCommand: ReturnType<typeof createMigrateCommandHandler>,
  cfg: OpenClawConfig
): Promise<string> {
  if (hasAmbiguousMigrationAccount(cfg)) {
    return MIGRATION_SINGLE_ACCOUNT_REQUIRED;
  }
  const result = resolveBridgeForCommand(ctx);
  if ('error' in result) {
    return result.error;
  }
  return handleMigrateCommand(result.bridge, rawArgs);
}
