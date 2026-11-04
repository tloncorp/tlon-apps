import { ReactNode, useState } from 'react';

import type { BucketFileNavigation } from './BucketFileViewer.shared';

/** Keep rendered documents available without retaining offscreen media players. */
export function useRetainedBucketPages(
  children: ReactNode,
  navigation: BucketFileNavigation | undefined,
  retainActivePage: boolean
) {
  const [retained, setRetained] = useState(
    () => new Map<string, { uri: string; node: ReactNode }>()
  );
  let nextRetained: typeof retained | undefined;
  const available = new Map(
    navigation?.items.map((item) => [item.id ?? item.name, item.uri])
  );
  for (const [key, page] of retained) {
    if (available.get(key) !== page.uri) {
      nextRetained = nextRetained ?? new Map(retained);
      nextRetained.delete(key);
    }
  }
  const activeItem = navigation?.items[navigation.index];
  if (
    retainActivePage &&
    activeItem?.uri &&
    retained.get(activeItem.id ?? activeItem.name)?.node !== children
  ) {
    // Preserve the mounted document and its position through a return swipe.
    // Audio/video pages are never retained, so leaving them stops playback.
    nextRetained = nextRetained ?? new Map(retained);
    nextRetained.delete(activeItem.id ?? activeItem.name);
    nextRetained.set(activeItem.id ?? activeItem.name, {
      uri: activeItem.uri,
      node: children,
    });
  }
  if (nextRetained) {
    // Mounted PDF renderers are heavier than cached URLs/text.
    while (nextRetained.size > 5)
      nextRetained.delete(nextRetained.keys().next().value!);
    setRetained(nextRetained);
  }
  return retained;
}
