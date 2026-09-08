import type { LegendListRef } from '@legendapp/list/react-native';

import type { PostListMethods } from '../ui/components/Channel/PostList/shared';

type Position = 'end' | 'near' | 'history' | 'top';

/** Controlled component setup through production commands, never raw list writes. */
export async function positionFixtureList(
  commands: PostListMethods,
  readState: LegendListRef['getState'],
  where: Position,
  pause: (ms: number) => Promise<void>
) {
  commands.scrollToEnd({ animated: false });
  let isCurrent = commands.captureScrollIntent?.() ?? (() => false);
  await pause(500);
  if (!isCurrent()) throw new Error('Fixture navigation was superseded');
  let postId: string | undefined;
  if (where === 'top') {
    commands.scrollToStart({ animated: false });
  } else if (where !== 'end') {
    const state = readState();
    if (
      !Number.isFinite(state.scroll) ||
      !Number.isFinite(state.scrollLength) ||
      !(state.scrollLength > 0)
    )
      throw new Error('Fixture navigation requires finite list geometry');
    const target =
      Math.max(
        0,
        state.scroll - (where === 'near' ? 220 : state.scrollLength * 3)
      ) +
      state.scrollLength / 2;
    let distance = Infinity;
    state.data.forEach((item, index) => {
      const key = item.post?.id ?? item.id;
      const position = state.positionAtIndex(index);
      const size = state.sizeAtIndex(index);
      const next = Math.abs(position + size / 2 - target);
      if (
        typeof key === 'string' &&
        key.length > 0 &&
        Number.isFinite(position) &&
        size > 0 &&
        Number.isFinite(size) &&
        next < distance
      ) {
        postId = key;
        distance = next;
      }
    });
    if (!postId) throw new Error('Fixture navigation has no valid target post');
    commands.scrollToPost({ postId, viewPosition: 0.5, animated: false });
  }
  isCurrent = commands.captureScrollIntent?.() ?? (() => false);
  await pause(600);
  if (!isCurrent()) throw new Error('Fixture navigation was superseded');
  return { where, postId, source: 'production-imperative-handle' };
}
