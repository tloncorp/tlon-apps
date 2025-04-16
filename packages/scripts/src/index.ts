import { inlineSummary } from '@tloncorp/shared/logic';
import type * as ub from '@tloncorp/shared/urbit';
import {
  getContent,
  getIdParts,
  getSourceForEvent,
  sourceToString,
} from '@tloncorp/shared/urbit/activity';

type PreviewContentNode =
  | { type: 'channelTitle'; channelId: string }
  | { type: 'stringLiteral'; content: string }
  | {
      type: 'concatenateStrings';
      first: PreviewContentNode;
      second: PreviewContentNode;
    };

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace PreviewContentNode {
  export function stringLiteral(content: string): PreviewContentNode {
    return { type: 'stringLiteral', content };
  }
  export function concatenateStrings(
    first: PreviewContentNode,
    second: PreviewContentNode
  ): PreviewContentNode {
    return { type: 'concatenateStrings', first, second };
  }
  export function channelTitle(channelId: string): PreviewContentNode {
    return { type: 'channelTitle', channelId };
  }
}

interface PreviewContentPayload {
  notification: {
    title: PreviewContentNode;
    body: PreviewContentNode;
    groupingKey: PreviewContentNode;
  };
  message?: {
    type: 'group' | 'dm';
    timestamp: number;
    senderId: string;
    conversationTitle: PreviewContentNode;
    messageText: PreviewContentNode;
  };
}

export function renderActivityEventPreview({
  event: ev,
}: {
  event: ub.ActivityEvent;
}): PreviewContentPayload | null {
  const content = getContent(ev);
  if (content == null) {
    // TODO: This will contain stuff like group invites - we should handle them.
    return null;
  }

  const { stringLiteral: lit, channelTitle } = PreviewContentNode;

  const source = getSourceForEvent(ev);
  const contentSummary = inlineSummary(content);

  return {
    notification: {
      title: (() => {
        if ('channel' in source) {
          return channelTitle(source.channel.nest);
        }
        return lit(sourceToString(source, true));
      })(),
      body: lit(contentSummary),
      groupingKey: lit(sourceToString(source, true)),
    },
    message: (() => {
      switch (true) {
        case is(ev, 'post'):
        // fallthrough
        case is(ev, 'reply'):
        // fallthrough
        case is(ev, 'dm-invite'):
        // fallthrough
        case is(ev, 'dm-reply'):
        // fallthrough
        case is(ev, 'group-ask'):
        // fallthrough
        case is(ev, 'group-join'):
        // fallthrough
        case is(ev, 'group-kick'):
        // fallthrough
        case is(ev, 'group-invite'):
        // fallthrough
        case is(ev, 'group-role'):
        // fallthrough
        case is(ev, 'flag-post'):
        // fallthrough
        case is(ev, 'contact'):
        // fallthrough
        case is(ev, 'flag-reply'):
          return undefined;

        case is(ev, 'dm-post'): {
          const { sent, author } = getIdParts(ev['dm-post'].key.id);
          return {
            type: 'dm',
            timestamp: sent,
            senderId: author,
            conversationTitle: lit('TODO: Channel name'),
            messageText: lit(contentSummary),
          };
        }

        default: {
          ((_x: never) => {
            throw new Error(`Unrecognized activity event type: ${ev}`);
          })(ev);
        }
      }
    })(),
  };
}

type UnionToIntersection<T> = {
  [E in T as keyof E]: E[keyof E];
};
function is<
  P extends ub.ActivityIncomingEvent,
  K extends keyof UnionToIntersection<ub.ActivityIncomingEvent>,
>(
  poly: P,
  type: K
): // @ts-expect-error - hey, I'm asserting here!
poly is Pick<UnionToIntersection<ub.ActivityIncomingEvent>, K> {
  return type in poly;
}
