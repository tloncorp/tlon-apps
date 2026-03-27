import { ChannelContentConfiguration } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { ReactElement, Ref, useMemo } from 'react';

import { useComponentsKitContext } from '../contexts/componentsKits';
import { ListPostCollection } from './postCollectionViews/ListPostCollectionView';
import {
  IPostCollectionView,
  PostCollectionHandle,
  PostCollectionViewProps,
} from './postCollectionViews/shared';

export function PostCollectionView({
  channel,
  collectionRef,
  listBottomComponent,
}: {
  channel: db.Channel;
  collectionRef: Ref<PostCollectionHandle>;
  listBottomComponent?: ReactElement;
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
  const collectionProps: PostCollectionViewProps = {
    listBottomComponent,
  };
  return <SpecificComponent {...collectionProps} ref={collectionRef} />;
}
