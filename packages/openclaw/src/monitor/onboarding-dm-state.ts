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

type OnboardingDmEntry =
  | { kind: 'active'; groupId: string }
  | { kind: 'inactive'; until: number };

export class OnboardingDmState {
  private readonly entries = new Map<string, OnboardingDmEntry>();

  /** A typed request names its group, and reopens a DM thought finished. */
  noteRequest(dm: string, groupId: string) {
    this.entries.set(dm, { kind: 'active', groupId });
  }

  /** The group a reply here belongs to, once a request has named it. */
  groupFor(dm: string): string | undefined {
    const entry = this.entries.get(dm);
    return entry?.kind === 'active' ? entry.groupId : undefined;
  }

  /** True while reply-shaped messages here need not consult onboarding. */
  isInactive(dm: string, now = Date.now()): boolean {
    const entry = this.entries.get(dm);
    if (entry?.kind !== 'inactive') return false;
    if (now < entry.until) return true;
    this.entries.delete(dm);
    return false;
  }

  /** What a history read found: the request's group, or nothing to act on. */
  noteLookup(dm: string, groupId: string | undefined, now = Date.now()) {
    if (groupId) {
      this.noteRequest(dm, groupId);
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
