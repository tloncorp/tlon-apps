import { useMemo } from 'react';

import { useChannelContext } from '../../contexts';
import {
  RenderItemType,
  useComponentsKitContext,
} from '../../contexts/componentsKits';
import { ChatMessage } from '../ChatMessage';
import { GalleryPost } from '../GalleryPost';
import { NotebookPost } from '../NotebookPost';

export const PostView: RenderItemType = (props) => {
  const channel = useChannelContext();
  const { renderers } = useComponentsKitContext();

  const SpecificPostComponent = useMemo(() => {
    // why do this iife?
    // without it, TypeScript thinks the value from `renderers[]` may be null.
    // sad!
    const rendererFromContentConfig = (() => {
      const contentConfig = channel.contentConfiguration;
      if (
        contentConfig != null &&
        renderers[contentConfig.defaultPostContentRenderer] != null
      ) {
        return renderers[contentConfig.defaultPostContentRenderer];
      }
    })();
    if (rendererFromContentConfig != null) {
      return rendererFromContentConfig;
    }

    // content config did not provide a renderer, fall back to default
    switch (channel.type) {
      case 'chat':
      // fallthrough
      case 'dm':
      // fallthrough
      case 'groupDm':
        return ChatMessage;

      case 'notebook':
        return NotebookPost;

      case 'gallery':
        return GalleryPost;
    }
  }, [channel.type, channel.contentConfiguration, renderers]);

  return <SpecificPostComponent {...props} />;
};
