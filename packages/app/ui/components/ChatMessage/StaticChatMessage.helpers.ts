import type { BlockData } from '@tloncorp/shared/logic';

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

/** Replace only the plain paragraph fallback duplicated by an A2UI surface. */
export function resolveA2UIContent(
  content: BlockData[],
  canRenderA2UI: boolean
): BlockData[] {
  if (!canRenderA2UI) {
    return content.filter((block) => block.type !== 'a2ui');
  }
  if (!content.some((block) => block.type === 'a2ui')) {
    return content;
  }
  let removedFallback = false;
  return content.filter((block) => {
    if (!removedFallback && block.type === 'paragraph') {
      removedFallback = true;
      return false;
    }
    return true;
  });
}
