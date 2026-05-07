export const TOOLTIP_USER_DISPLAY_COUNT = 3;
export const TOOLTIP_MAX_WIDTH_PX = 320;
export const TOOLTIP_NAME_FRAGMENT_MAX_WIDTH_PX = 280;
export const TOOLTIP_VIEWPORT_GUTTER_PX = 32;

export function getReactionTooltipDisplayPlan<T extends { id: string }>(
  users: T[]
): { displayed: T[]; moreCount: number } {
  const displayed = users.slice(0, TOOLTIP_USER_DISPLAY_COUNT);
  return {
    displayed,
    moreCount: Math.max(0, users.length - displayed.length),
  };
}
