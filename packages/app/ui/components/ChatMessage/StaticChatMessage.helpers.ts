const TIMEZONE_ACTION_TEXT = 'Timezone: {{tlon.timezone}}';

/** Resolve the onboarding timezone token only on trusted group surfaces. */
export function resolveA2UISendText(
  actionText: string,
  groupId: string | null | undefined,
  timezone: string
): string {
  const trimmed = actionText.trim();
  return groupId && trimmed === TIMEZONE_ACTION_TEXT
    ? `Timezone: ${timezone}`
    : trimmed;
}
