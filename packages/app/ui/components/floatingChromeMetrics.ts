/**
 * Geometry shared by the floating chrome surfaces layered over a conversation:
 * the composer row, its action buttons, and the scroll-to-bottom button.
 *
 * iOS and Android differ only in surface treatment - liquid glass / blur vs
 * material elevation - while the layout stays identical, and the round controls
 * are the same size wherever they appear. Keeping the numbers here stops them
 * drifting between the platform files.
 *
 * Deliberately free of platform imports so both `.ios.tsx` and `.android.tsx`
 * chrome can use it. The default (web) chrome is a different design built from
 * Tamagui tokens and does not.
 */
export const floatingChromeMetrics = {
  /** Round control: composer action buttons and the scroll-to-bottom button. */
  controlSize: 48,
  /** Corner radius for the round controls and the composer body pill. */
  controlRadius: 24,
  rowGap: 8,
  rowPaddingHorizontal: 12,
  rowPaddingVertical: 8,
} as const;
