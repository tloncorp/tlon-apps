import { forwardRef } from 'react';

import { ListPostCollection } from './ListPostCollectionView';
import { IPostCollectionView } from './shared';

export const PostCollectionView: IPostCollectionView = forwardRef(
  function PostCollection(props, forwardedRef) {
    return (
      <ListPostCollection
        ref={forwardedRef}
        channel={props.channel}
        collectionLayout={props.collectionLayout}
      />
    );
  }
);
