export type PersonalInviteLinkState = 'ready' | 'loading' | 'unavailable';

/**
 * The link's absence alone cannot tell loading from failure: verification runs
 * in the background and, when it fails, schedules nothing further. The failure
 * it records separates the two, so a screen stops waiting on what will not come.
 */
export function resolvePersonalInviteLinkState({
  inviteUrl,
  unavailable,
}: {
  inviteUrl: string | null | undefined;
  unavailable: boolean;
}): PersonalInviteLinkState {
  if (inviteUrl) return 'ready';
  return unavailable ? 'unavailable' : 'loading';
}
