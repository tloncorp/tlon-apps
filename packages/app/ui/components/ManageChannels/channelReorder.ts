/** A group's channels by section, in order. */
export type ChannelOrder = {
  sectionId: string;
  title: string;
  channelIds: string[];
}[];

/** One row of the single list that reorders channels across sections. */
export type ChannelReorderItem =
  | { kind: 'heading'; sectionId: string }
  | { kind: 'channel'; id: string };

/**
 * Moves the items at `from` to before `to`, both counted in the list before
 * the move, as SwiftUI reports one.
 */
export function reorder<T>(items: T[], from: number[], to: number): T[] {
  const moving = from.map((index) => items[index]);
  const rest = items.filter((_, index) => !from.includes(index));
  rest.splice(to - from.filter((index) => index < to).length, 0, ...moving);
  return rest;
}

/** Every channel in one list, each section's name above its channels. */
export function channelReorderItems(order: ChannelOrder): ChannelReorderItem[] {
  return order.flatMap((section) => [
    { kind: 'heading' as const, sectionId: section.sectionId },
    ...section.channelIds.map((id) => ({ kind: 'channel' as const, id })),
  ]);
}

/**
 * The order after a move in that list. A channel joins the section named
 * above it, and one dropped above every name joins the first section. Names
 * can't be dragged, so any in the move stay where they are. Returns null when
 * nothing moves.
 */
export function moveChannels(
  order: ChannelOrder,
  from: number[],
  to: number
): ChannelOrder | null {
  const items = channelReorderItems(order);
  const moving = from.filter((index) => items[index]?.kind === 'channel');
  if (moving.length === 0) return null;
  const next = order.map((section) => ({
    ...section,
    channelIds: [] as string[],
  }));
  let sectionIndex = 0;
  for (const item of reorder(items, moving, to)) {
    if (item.kind === 'heading') {
      sectionIndex = next.findIndex(
        (section) => section.sectionId === item.sectionId
      );
    } else {
      next[sectionIndex].channelIds.push(item.id);
    }
  }
  return next;
}
