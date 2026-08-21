export const CONTEXT_LENS_PANEL_WIDTH = 360;
export const CONTEXT_LENS_MIN_INLINE_CHAT_WIDTH = 400;
export const CONTEXT_LENS_MIN_INLINE_CONTAINER_WIDTH =
  CONTEXT_LENS_PANEL_WIDTH + CONTEXT_LENS_MIN_INLINE_CHAT_WIDTH;

export function estimateDesktopConversationWidth(
  windowWidth: number,
  navigationWidth: number
): number {
  return Math.max(0, windowWidth - navigationWidth);
}

export function shouldOverlayContextLens(
  containerWidth: number | null
): boolean {
  return (
    containerWidth === null ||
    containerWidth < CONTEXT_LENS_MIN_INLINE_CONTAINER_WIDTH
  );
}
