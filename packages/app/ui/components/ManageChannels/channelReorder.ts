import { isEqual } from 'lodash';

/** A group's channels by section, in order. */
export type ChannelOrder = {
  sectionId: string;
  title: string;
  channelIds: string[];
}[];

/** A group's sections as a channel order. */
export function channelOrder(
  sections: {
    sectionId: string;
    title?: string | null;
    channels: { id: string }[];
  }[]
): ChannelOrder {
  return sections.map((section) => ({
    sectionId: section.sectionId,
    title: section.title ?? '',
    channelIds: section.channels.map((channel) => channel.id),
  }));
}

/** The order as `updateGroupNavigation` takes it. */
export function navigationUpdate(order: ChannelOrder) {
  return order.map((section, sectionIndex) => ({
    sectionId: section.sectionId,
    sectionIndex,
    channels: section.channelIds.map((channelId, channelIndex) => ({
      channelId,
      channelIndex,
    })),
  }));
}

/**
 * The order with a section's channels moved out before it's deleted, so they
 * stay listed. They join the section above it, as they would if its name left
 * the list, or the start of the section below when it's first. Returns null
 * when it has no channels to move.
 */
export function emptySection(
  order: ChannelOrder,
  sectionId: string
): ChannelOrder | null {
  const index = order.findIndex((section) => section.sectionId === sectionId);
  const moving = order[index]?.channelIds ?? [];
  const target = index > 0 ? index - 1 : index + 1;
  if (moving.length === 0 || !order[target]) return null;
  return order.map((section, i) =>
    i === index
      ? { ...section, channelIds: [] }
      : i === target
        ? {
            ...section,
            channelIds:
              index > 0
                ? [...section.channelIds, ...moving]
                : [...moving, ...section.channelIds],
          }
        : section
  );
}

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
 * The order after a move in that list, read the way Android and web read
 * theirs: sections come in the order of their names, and a channel belongs to
 * the section named above it. So moving a name moves where its section
 * starts. A channel above every name joins the first section. Returns null
 * when nothing changes.
 */
export function moveChannels(
  order: ChannelOrder,
  from: number[],
  to: number
): ChannelOrder | null {
  const items = reorder(channelReorderItems(order), from, to);
  const next: ChannelOrder = [];
  const beforeFirstName: string[] = [];
  for (const item of items) {
    if (item.kind === 'heading') {
      const section = order.find(
        (candidate) => candidate.sectionId === item.sectionId
      );
      if (section) next.push({ ...section, channelIds: [] });
    } else if (next.length === 0) {
      beforeFirstName.push(item.id);
    } else {
      next[next.length - 1].channelIds.push(item.id);
    }
  }
  if (next.length > 0) {
    next[0].channelIds.unshift(...beforeFirstName);
  }
  return isEqual(next, order) ? null : next;
}
