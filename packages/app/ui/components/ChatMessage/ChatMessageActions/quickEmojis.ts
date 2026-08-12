import { getNativeEmoji } from '@tloncorp/ui';

/** Number of slots given to the user's most-used emoji. */
export const FREQUENT_SLOT_COUNT = 3;

/** Fills the frequent slots until the user has enough reaction history. */
export const DEFAULT_QUICK_EMOJIS = ['+1', 'heart', 'laughing'];

/**
 * Stands in for the last slot when there's no self reaction to surface there.
 * It's reserved: a frequent slot showing it too would render the same button
 * twice and burn one of the three slots.
 */
export const LAST_SLOT_PLACEHOLDER = '🌀';

/**
 * A slot holds either one of the default shortcodes or a native glyph pulled
 * from reaction history. History entries are already native and were validated
 * when the reaction was sent, so fall back to the stored glyph rather than
 * dropping the slot if `getNativeEmoji` doesn't recognize it.
 */
export function resolveSlotEmoji(slot: string) {
  return getNativeEmoji(slot) ?? slot;
}

/**
 * Picks the frequent slots from `sortedByUsage` (most-used first), backfilling
 * with defaults so the toolbar is never short. Returns slot values in their
 * original form — a shortcode stays a shortcode.
 */
export function selectFrequentEmojis(sortedByUsage: string[]): string[] {
  const seen = new Set<string>([LAST_SLOT_PLACEHOLDER]);
  const slots: string[] = [];

  const take = (emoji: string) => {
    const native = resolveSlotEmoji(emoji);
    if (seen.has(native)) {
      return;
    }
    seen.add(native);
    slots.push(emoji);
  };

  sortedByUsage.forEach(take);
  DEFAULT_QUICK_EMOJIS.forEach(take);

  return slots.slice(0, FREQUENT_SLOT_COUNT);
}
