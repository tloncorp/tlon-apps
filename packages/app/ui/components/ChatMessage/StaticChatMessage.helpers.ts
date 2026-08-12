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

/** Hide unsupported A2UI blocks without discarding adjacent message prose. */
export function resolveA2UIContent(
  content: BlockData[],
  canRenderA2UI: boolean
): BlockData[] {
  if (!canRenderA2UI) {
    return content.filter((block) => block.type !== 'a2ui');
  }
  return content;
}
