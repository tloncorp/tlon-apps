/**
 * Post kind tails for surface channels.
 *
 * `%channels-server` requires every post's kind head to equal the channel's
 * nest kind, so surface records ride under the channel's own kind head
 * (`/chat/surface/...`). Post writers accept only the tails allowlisted
 * here, so the TS layer cannot mint any other kind path.
 */
export const SURFACE_POST_KIND_TAILS = [
  'surface/spec',
  'surface/event',
  'surface/snapshot',
] as const;

export type SurfacePostKindTail = (typeof SURFACE_POST_KIND_TAILS)[number];

export function isSurfacePostKindTail(
  value: unknown
): value is SurfacePostKindTail {
  return (SURFACE_POST_KIND_TAILS as readonly unknown[]).includes(value);
}
