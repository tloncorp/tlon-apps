/**
 * Where onboarding stands in each DM, so the control plane is consulted only
 * where it could act. Consulting it costs a 500-writ history read, and
 * onboarding is a sliver of DM traffic: without this, every "yes" or "done"
 * the owner ever types would pay that read, long after onboarding finished.
 */

/** A DM found to hold no request is asked again after this long. */
export const ONBOARDING_DM_NO_REQUEST_RECHECK_MS = 5 * 60_000;
/** A finished DM is trusted for this long; a new request reopens it at once. */
export const ONBOARDING_DM_COMPLETE_RECHECK_MS = 12 * 60 * 60_000;
/**
 * First-run onboarding lasts this long after the intro request, whether or not
 * the owner sets up a task. Nearly everyone who talks to their bot at all
 * does so within a day of the welcome; after that they get the ordinary bot.
 */
export const FIRST_RUN_ONBOARDING_WINDOW_MS = 24 * 60 * 60_000;

/** The intro request a DM's onboarding hangs off. */
export type OnboardingRequestRef = { groupId: string; requestedAt: number };

type OnboardingDmEntry =
  | ({ kind: 'active' } & OnboardingRequestRef)
  | { kind: 'inactive'; until: number };

export class OnboardingDmState {
  private readonly entries = new Map<string, OnboardingDmEntry>();

  /** A typed request names its group, and reopens a DM thought finished. */
  noteRequest(dm: string, groupId: string, requestedAt = Date.now()) {
    this.entries.set(dm, { kind: 'active', groupId, requestedAt });
  }

  /** The group a reply here belongs to, while its first day lasts. */
  groupFor(dm: string, now = Date.now()): string | undefined {
    const entry = this.entries.get(dm);
    return entry?.kind === 'active' &&
      now - entry.requestedAt < FIRST_RUN_ONBOARDING_WINDOW_MS
      ? entry.groupId
      : undefined;
  }

  /** The group whose onboarding here has outlived its first day. */
  lapsedGroupFor(dm: string, now = Date.now()): string | undefined {
    const entry = this.entries.get(dm);
    return entry?.kind === 'active' &&
      now - entry.requestedAt >= FIRST_RUN_ONBOARDING_WINDOW_MS
      ? entry.groupId
      : undefined;
  }

  /** True while reply-shaped messages here need not consult onboarding. */
  isInactive(dm: string, now = Date.now()): boolean {
    const entry = this.entries.get(dm);
    if (entry?.kind !== 'inactive') return false;
    if (now < entry.until) return true;
    this.entries.delete(dm);
    return false;
  }

  /** What a history read found: the request, or nothing to act on. */
  noteLookup(
    dm: string,
    found: OnboardingRequestRef | undefined,
    now = Date.now()
  ) {
    if (found) {
      this.noteRequest(dm, found.groupId, found.requestedAt);
      return;
    }
    this.entries.set(dm, {
      kind: 'inactive',
      until: now + ONBOARDING_DM_NO_REQUEST_RECHECK_MS,
    });
  }

  /** Onboarding here has finished; only a new request reopens it. */
  noteComplete(dm: string, now = Date.now()) {
    this.entries.set(dm, {
      kind: 'inactive',
      until: now + ONBOARDING_DM_COMPLETE_RECHECK_MS,
    });
  }
}
