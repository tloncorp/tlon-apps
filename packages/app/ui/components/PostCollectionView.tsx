import {
  ChannelContentConfiguration,
  CollectionRendererId,
} from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { Ref, useMemo } from 'react';

import { useComponentsKitContext } from '../contexts/componentsKits';
import { ListPostCollection } from './postCollectionViews/ListPostCollectionView';
import {
  IPostCollectionView,
  PostCollectionHandle,
} from './postCollectionViews/shared';

function fallbackRendererIdForChannelType(
  type: db.Channel['type']
): CollectionRendererId | null {
  switch (type) {
    case 'urbit-notes':
      return CollectionRendererId.urbitNotes;
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
    const rendererFromContentConfig = (() => {
      const contentConfig = channel.contentConfiguration;
      if (contentConfig == null) {
        return null;
      }
      const collectionConfig =
        ChannelContentConfiguration.defaultPostCollectionRenderer(
          contentConfig
        );
      if (
        contentConfig != null &&
        collectionRenderers[collectionConfig.id] != null
      ) {
        return collectionRenderers[collectionConfig.id];
      }
    })();
    if (rendererFromContentConfig) return rendererFromContentConfig;

    const fallbackId = fallbackRendererIdForChannelType(channel.type);
    if (fallbackId && collectionRenderers[fallbackId]) {
      return collectionRenderers[fallbackId]!;
    }

    return ListPostCollection;
  }, [channel.contentConfiguration, channel.type, collectionRenderers]);
  return <SpecificComponent ref={collectionRef} />;
}
