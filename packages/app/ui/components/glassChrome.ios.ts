import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';

/**
 * Whether this device can render Liquid Glass.
 *
 * Every floating iOS chrome surface gates on this and falls back to
 * `glassFallbackBlurProps` when it is false, so they all degrade together
 * instead of one surface going glass while its neighbour stays blurred.
 */
export function canUseLiquidGlass() {
  return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
}

/** Blur treatment standing in for Liquid Glass on devices without it. */
export const glassFallbackBlurProps = {
  tint: 'systemMaterial',
  intensity: 90,
} as const;
