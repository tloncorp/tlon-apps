/**
 * Group-invite (foreigns) processing, extracted from the monitor closure so
 * it is unit-testable. Suppression model: see "Group invite handling" in
 * SECURITY.md — the queue path never marks the processed set.
 */
import type { Foreigns } from '../urbit/foreigns.js';
import { resolveGroupInviteAction } from './utils.js';

export type GroupInviteDeps = {
  /** Accept-success + decision-blocked only; the queue path never marks. */
  processedGroupInvites: Set<string>;
  ownerShip: string | null;
  allowlist: () => string[];
  /** Must reject (not swallow) on failure — see resolveGroupInviteAction. */
  fetchBlockedShips: () => Promise<string[]>;
  acceptInvite: (groupFlag: string) => Promise<void>;
  /** Idempotent; owns dedup/delivery/cooldown (see applyApprovalRequest). */
  queueApproval: (input: {
    requestingShip: string;
    groupFlag: string;
    groupTitle?: string;
  }) => Promise<void>;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
};

/**
 * Narrow a raw catch-up scry response to `Foreigns`, throwing on anything
 * that is not a flag→foreign map so a malformed response reaches the
 * caller's error path instead of passing as an empty, successful catch-up.
 * `{}` is a legitimate snapshot: no pending invites.
 */
export function parseForeignsSnapshot(raw: unknown): Foreigns {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Foreigns;
  }
  throw new Error('Malformed foreigns snapshot: expected a flag→foreign map');
}

export async function processPendingForeigns(
  foreigns: Foreigns,
  deps: GroupInviteDeps
): Promise<void> {
  if (!foreigns || typeof foreigns !== 'object') {
    return;
  }

  // One block-list scry per batch, shared by every invite in it and
  // fetched lazily so a batch with no allowlisted inviter costs none.
  // Without this a startup backlog of N allowlisted invites would issue
  // N sequential scries — up to 15s each — before the foreigns
  // subscription is even established.
  let blockedShipsOnce: Promise<string[]> | null = null;
  const fetchBlockedShips = () =>
    (blockedShipsOnce ??= deps.fetchBlockedShips());

  for (const [groupFlag, foreign] of Object.entries(foreigns)) {
    if (deps.processedGroupInvites.has(groupFlag)) {
      continue;
    }
    // No invites (yet) is normal for previews/joins-in-progress — stay silent.
    if (!foreign.invites || foreign.invites.length === 0) {
      continue;
    }

    const validInvite = foreign.invites.find((inv) => inv.valid);
    if (!validInvite) {
      deps.log?.(
        `[tlon] Group ${groupFlag} has ${foreign.invites.length} invite(s) but none valid; skipping`
      );
      continue;
    }

    const inviterShip = validInvite.from;

    const decision = await resolveGroupInviteAction(
      {
        inviterShip,
        ownerShip: deps.ownerShip,
        allowlist: deps.allowlist(),
      },
      {
        // SECURITY: pass the scryBlockedShips-backed fetcher (rejects
        // on failure or a malformed payload), NOT isShipBlocked (which
        // swallows errors to "not blocked"). A rejection means
        // "unknown" and must never auto-accept — see
        // resolveGroupInviteAction.
        fetchBlockedShips,
      }
    );

    if (decision.action === 'accept') {
      try {
        await deps.acceptInvite(groupFlag);
        // Mark processed only on success — failure retries on the
        // next foreigns event.
        deps.processedGroupInvites.add(groupFlag);
        deps.log?.(
          `[tlon] Auto-accepted group invite (${decision.reason}): ${groupFlag} (from ${inviterShip})`
        );
      } catch (err) {
        deps.error?.(
          `[tlon] Failed to accept group invite (${decision.reason}) ${groupFlag}: ${String(err)}`
        );
      }
      continue;
    }

    if (decision.action === 'queue') {
      // Do NOT mark processed — suppression/retry live in the approval record.
      await deps.queueApproval({
        requestingShip: inviterShip,
        groupFlag,
        groupTitle: validInvite.preview?.meta?.title,
      });
      continue;
    }

    if (decision.reason === 'blocked') {
      // Confirmed blocked: silent ignore, no approval card. Routing
      // this through queueApproval would re-ask the fail-open
      // isShipBlocked and could card a ship known to be blocked.
      deps.log?.(
        `[tlon] Ignoring group invite from blocked ship ${inviterShip}: ${groupFlag}`
      );
      deps.processedGroupInvites.add(groupFlag);
      continue;
    }

    // ignore/no-owner: log but leave unprocessed so a later allowlist
    // edit can pick the invite up on the next foreigns event.
    deps.log?.(
      `[tlon] Ignoring group invite from ${inviterShip} (not in groupInviteAllowlist, no owner configured): ${groupFlag}`
    );
  }
}

/**
 * Serialize processor runs across the entry points so they never interleave;
 * catchUp() additionally coalesces while queued-or-running. Rejections are
 * observed inside the runner, and nothing is enqueued after abort.
 */
export function createCatchUpRunner(
  run: () => Promise<void>,
  opts: { abortSignal?: AbortSignal; error?: (msg: string) => void } = {}
) {
  let chain: Promise<void> = Promise.resolve();
  let queuedCatchUp: Promise<void> | null = null;

  const isAborted = () => Boolean(opts.abortSignal?.aborted);
  const report = opts.error;

  const enqueueTask = (task: () => Promise<void>): Promise<void> => {
    if (isAborted()) {
      return Promise.resolve();
    }
    const next = chain.then(async () => {
      if (isAborted()) {
        return;
      }
      try {
        await task();
      } catch (err) {
        report?.(
          `[tlon] Group-invite processing failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    });
    chain = next;
    return next;
  };

  return {
    catchUp() {
      if (queuedCatchUp) {
        return queuedCatchUp;
      }
      const current = enqueueTask(run);
      queuedCatchUp = current;
      void current.then(() => {
        if (queuedCatchUp === current) {
          queuedCatchUp = null;
        }
      });
      return current;
    },
    enqueue(task: () => Promise<void>) {
      return enqueueTask(task);
    },
  };
}
