import {
  ChannelContentConfiguration,
  CollectionRendererId,
} from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Ref, useMemo } from 'react';

import {
  resolveChannelView,
  useComponentsKitContext,
} from '../contexts/componentsKits';
import { ListPostCollection } from './postCollectionViews/ListPostCollectionView';
import {
  IPostCollectionView,
  PostCollectionHandle,
} from './postCollectionViews/shared';

const logger = createDevLogger('PostCollectionView', false);

function fallbackRendererIdForChannelType(
  type: db.Channel['type']
): CollectionRendererId | null {
  switch (type) {
    case 'notes':
      return CollectionRendererId.notes;
    default:
      return null;
  }
}

export function PostCollectionView({
  channel,
  collectionRef,
}: {
  channel: db.Channel;
  collectionRef: Ref<PostCollectionHandle>;
}) {
  const { collectionRenderers } = useComponentsKitContext();
  const SpecificComponent: IPostCollectionView = useMemo(() => {
    const fallbackId = fallbackRendererIdForChannelType(channel.type);
    const fallback =
      (fallbackId ? collectionRenderers[fallbackId] : null) ??
      ListPostCollection;

    const contentConfig = channel.contentConfiguration;
    const { component, resolved, declaredId } = resolveChannelView({
      declaredId:
        contentConfig == null
          ? null
          : ChannelContentConfiguration.defaultPostCollectionRenderer(
              contentConfig
            ).id,
      registry: collectionRenderers,
      fallback,
    });

    // Falling back keeps the posts readable, which is the whole degradation
    // for this slot — a notice here would mean blanking the channel. The
    // user-facing notice lives at the composer, where rendering nothing is not
    // survivable. See docs/tlon-apps/channel-views.md.
    if (!resolved) {
      logger.log(
        `channel ${channel.id} declares unregistered collection view "${declaredId}"; rendering the post list instead`
      );
    }

    return component ?? ListPostCollection;
  }, [
    channel.contentConfiguration,
    channel.id,
    channel.type,
    collectionRenderers,
  ]);
  return <SpecificComponent ref={collectionRef} />;
}
