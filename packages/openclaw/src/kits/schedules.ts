/**
 * Kit schedule reconciliation: realize the install config's `schedules[]`
 * (id + cron expr) as gateway cron jobs.
 *
 * Jobs are named `tlon:kit:<groupFlag>:<scheduleId>`. Reconciliation is
 * global over that namespace: add missing jobs, update drifted ones, remove
 * orphans left behind by uninstalled kits. Each job enqueues a system event
 * (the matching on-trigger instruction's content, prefixed with one line of
 * kit context) into the group channel's session so the reply lands in the
 * kit's primary place via the session's durable Tlon route.
 */
import type { Kit } from '@tloncorp/api';
import type {
  PluginHookGatewayCronCreateInput,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';

import {
  findTriggerBindingContent,
  formatKitContextLine,
  resolvePrimaryPlaceNest,
} from './ambient.js';
import type { InstalledKitConfig } from './group-config.js';

export const KIT_CRON_JOB_PREFIX = 'tlon:kit:';

export function kitCronJobName(groupFlag: string, scheduleId: string): string {
  return `${KIT_CRON_JOB_PREFIX}${groupFlag}:${scheduleId}`;
}

export type DesiredKitCronJob = {
  name: string;
  description: string;
  scheduleExpr: string;
  sessionTarget: string;
  payloadText: string;
};

/**
 * Compute the desired cron jobs for the kits installed in one group.
 * Schedules without a matching `schedule.<id>` on-trigger binding (or whose
 * instruction file is missing from the package) are skipped with a log.
 */
export function buildDesiredKitCronJobs(params: {
  groupFlag: string;
  entries: Array<{ entry: InstalledKitConfig; kit: Kit }>;
  /** Group-channel nest → session key (`session:` prefix added here). */
  resolveSessionKey: (nest: string) => string | null;
  log?: (msg: string) => void;
}): DesiredKitCronJob[] {
  const { groupFlag, entries, resolveSessionKey, log } = params;
  const desired: DesiredKitCronJob[] = [];
  for (const { entry, kit } of entries) {
    const primaryNest = resolvePrimaryPlaceNest(entry.places);
    if (!primaryNest) {
      log?.(
        `[tlon] kits: ${entry.installId} in ${groupFlag} has no chat place; skipping schedules`
      );
      continue;
    }
    const sessionKey = resolveSessionKey(primaryNest);
    if (!sessionKey) {
      log?.(
        `[tlon] kits: cannot resolve session for ${primaryNest}; skipping schedules`
      );
      continue;
    }
    for (const schedule of entry.schedules) {
      const content = findTriggerBindingContent(kit, `schedule.${schedule.id}`);
      if (!content) {
        log?.(
          `[tlon] kits: ${entry.kit.id} has no on-trigger binding for schedule.${schedule.id}; skipping`
        );
        continue;
      }
      const contextLine = formatKitContextLine({
        label: `Kit schedule ${schedule.id}`,
        kitId: entry.kit.id,
        groupFlag,
        places: entry.places,
      });
      desired.push({
        name: kitCronJobName(groupFlag, schedule.id),
        description: `Kit ${entry.kit.id} schedule ${schedule.id} for ${groupFlag}`,
        scheduleExpr: schedule.cron,
        sessionTarget: `session:${sessionKey}`,
        payloadText: `${contextLine}\n${content.trim()}`,
      });
    }
  }
  return desired;
}

/**
 * Reconcile the gateway's `tlon:kit:*` cron jobs against the desired set.
 * Idempotent: an unchanged desired set produces no writes.
 */
export async function reconcileKitCronJobs(params: {
  cron: PluginHookGatewayCronService;
  desired: DesiredKitCronJob[];
  log?: (msg: string) => void;
}): Promise<{ added: number; updated: number; removed: number; kept: number }> {
  const { cron, desired, log } = params;
  const desiredByName = new Map(desired.map((job) => [job.name, job]));
  const existing = (await cron.list({ includeDisabled: true })).filter((job) =>
    (job.name ?? '').startsWith(KIT_CRON_JOB_PREFIX)
  );

  let added = 0;
  let updated = 0;
  let removed = 0;
  let kept = 0;

  const seen = new Set<string>();
  for (const job of existing) {
    const name = job.name ?? '';
    const want = desiredByName.get(name);
    if (!want || seen.has(name)) {
      await cron.remove(job.id);
      removed += 1;
      log?.(`[tlon] kits: removed orphaned cron job ${name || job.id}`);
      continue;
    }
    seen.add(name);
    const schedule = job.schedule;
    const matches =
      job.enabled !== false &&
      schedule?.kind === 'cron' &&
      schedule.expr === want.scheduleExpr &&
      job.sessionTarget === want.sessionTarget &&
      job.payload?.kind === 'agentTurn' &&
      (job.payload as { message?: string })?.message === want.payloadText;
    if (matches) {
      kept += 1;
      continue;
    }
    await cron.update(job.id, toCronInput(want));
    updated += 1;
    log?.(`[tlon] kits: updated cron job ${name}`);
  }

  for (const want of desired) {
    if (seen.has(want.name)) {
      continue;
    }
    await cron.add(toCronInput(want));
    added += 1;
    log?.(`[tlon] kits: added cron job ${want.name}`);
  }

  return { added, updated, removed, kept };
}

function toCronInput(job: DesiredKitCronJob): PluginHookGatewayCronCreateInput {
  return {
    name: job.name,
    description: job.description,
    enabled: true,
    schedule: { kind: 'cron', expr: job.scheduleExpr },
    sessionTarget: job.sessionTarget,
    wakeMode: 'now',
    // Session-targeted jobs must carry an agentTurn payload — the host
    // rejects any other pairing (main ↔ systemEvent, session ↔ agentTurn).
    // The cast is because the SDK's payload type lags the host contract:
    // agentTurn payloads carry `message`, which the type does not know yet.
    payload: {
      kind: 'agentTurn',
      message: job.payloadText,
    } as PluginHookGatewayCronCreateInput['payload'],
  };
}
