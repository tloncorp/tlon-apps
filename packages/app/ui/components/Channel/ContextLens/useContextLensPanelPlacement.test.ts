import { describe, expect, it } from 'vitest';

import {
  CONTEXT_LENS_MIN_INLINE_CONTAINER_WIDTH,
  estimateDesktopConversationWidth,
  shouldOverlayContextLens,
} from './contextLensPanelPlacement';

describe('shouldOverlayContextLens', () => {
  it('uses the safe overlay placement before the conversation is measured', () => {
    expect(shouldOverlayContextLens(null)).toBe(true);
  });

  it('overlays when an inline panel would leave the chat too narrow', () => {
    expect(
      shouldOverlayContextLens(CONTEXT_LENS_MIN_INLINE_CONTAINER_WIDTH - 1)
    ).toBe(true);
  });

  it('stays inline once the panel can leave a usable chat column', () => {
    expect(
      shouldOverlayContextLens(CONTEXT_LENS_MIN_INLINE_CONTAINER_WIDTH)
    ).toBe(false);
    expect(shouldOverlayContextLens(1200)).toBe(false);
  });
});

describe('estimateDesktopConversationWidth', () => {
  it('accounts for both permanent browser-desktop navigation columns', () => {
    expect(estimateDesktopConversationWidth(900, 373)).toBe(527);
    expect(estimateDesktopConversationWidth(1600, 373)).toBe(1227);
  });
});
