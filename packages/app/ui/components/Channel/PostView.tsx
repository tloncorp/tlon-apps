import { ChannelContentConfiguration } from '@tloncorp/api';
import { JSONValue, createDevLogger } from '@tloncorp/shared';
import { useMemo } from 'react';

import { useChannelContext } from '../../contexts/channel';
import { resolveChannelView } from '../../contexts/componentsKits/channelViews';
import {
  RenderItemType,
  useComponentsKitContext,
} from '../../contexts/componentsKits/componentsKits';
import { ChatMessage } from '../ChatMessage';
import { GalleryPost } from '../GalleryPost';
import { NotebookPost } from '../NotebookPost';

const logger = createDevLogger('PostView', false);

export const PostView: RenderItemType = (props) => {
  const channel = useChannelContext();
  const { renderers } = useComponentsKitContext();

  const SpecificPostComponent = useMemo(() => {
    // content config takes precedence; an id it names that nothing has
    // registered falls through to the channel-type default below, which keeps
    // the post readable. See docs/tlon-apps/channel-views.md.
    const { component, resolved, declaredId } = resolveChannelView({
      declaredId:
        channel.contentConfiguration == null
          ? null
          : ChannelContentConfiguration.defaultPostContentRenderer(
              channel.contentConfiguration
            ).id,
      registry: renderers,
    });
    if (component != null) {
      return component;
    }
    if (!resolved) {
      logger.log(
        `channel ${channel.id} declares unregistered content view "${declaredId}"; rendering the channel-type default instead`
      );
    }

    // content config did not provide a renderer, fall back to default
    switch (channel.type) {
      case 'notebook':
        return NotebookPost;

      case 'gallery':
        return GalleryPost;

      // Chat, DMs and group DMs render chat messages. Notes channels are drawn
      // entirely by the collection WebView, so no per-post content shows, but
      // something still has to be returned. And a type this build doesn't know
      // — from a newer client, or one added without revisiting this switch —
      // must not fall out of the switch: that returns undefined, which renders
      // as `<undefined>` and throws.
      default:
        return ChatMessage;
    }
  }, [channel.type, channel.contentConfiguration, channel.id, renderers]);

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
