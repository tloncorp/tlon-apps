import { JSONValue } from '@tloncorp/shared';
import { ChannelContentConfiguration } from '@tloncorp/shared/api';
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
      const contentConfig =
        channel.contentConfiguration == null
          ? null
          : ChannelContentConfiguration.defaultPostContentRenderer(
              channel.contentConfiguration
            );
      if (contentConfig != null && renderers[contentConfig.id] != null) {
        return renderers[contentConfig.id];
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

  const contentRendererConfiguration = useMemo(() => {
    if (channel.contentConfiguration == null) {
      return undefined;
    }
    return ChannelContentConfiguration.defaultPostContentRenderer(
      channel.contentConfiguration
    ).configuration;
  }, [channel.contentConfiguration]);

  // this code is duplicated in packages/ui/components/postCollectionViews/shared.tsx
  const standardConfig = useMemo(() => {
    if (channel.contentConfiguration == null) {
      return null;
    }
    const cfg = ChannelContentConfiguration.defaultPostCollectionRenderer(
      channel.contentConfiguration
    ).configuration;
    if (cfg == null) {
      return null;
    }
    return {
      showAuthor:
        props.showAuthor && JSONValue.asBoolean(cfg.showAuthors, false),
      showReplies:
        props.showReplies && JSONValue.asBoolean(cfg.showReplies, false),
    } as const;
  }, [channel.contentConfiguration, props.showAuthor, props.showReplies]);

  return (
    <SpecificPostComponent
      contentRendererConfiguration={contentRendererConfiguration}
      {...props}
      {...(standardConfig ?? {})}
    />
  );
};
