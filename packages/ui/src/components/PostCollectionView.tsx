import { ChannelContentConfiguration } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Ref, useMemo } from 'react';

import { useComponentsKitContext } from '../contexts/componentsKits';
import { ListPostCollection } from './postCollectionViews/ListPostCollectionView';
import {
  IPostCollectionView,
  PostCollectionHandle,
} from './postCollectionViews/shared';

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
    return rendererFromContentConfig ?? ListPostCollection;
  }, [channel.contentConfiguration, collectionRenderers]);
  return <SpecificComponent ref={collectionRef} />;
}
