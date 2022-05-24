/*
 *  Clamp a number between a min and max
 */
export default function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}
