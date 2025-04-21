import { inlineSummary } from '@tloncorp/shared/logic';
import type * as ub from '@tloncorp/shared/urbit';
import {
  ActivityIncomingEvent,
  getContent,
  getIdParts,
  getSourceForEvent,
  sourceToString,
} from '@tloncorp/shared/urbit/activity';

type PreviewContentNode =
  | { type: 'channelTitle'; channelId: string }
  | { type: 'userNickname'; ship: string }
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
  export function userNickname(ship: string): PreviewContentNode {
    return { type: 'userNickname', ship };
  }
}

interface PreviewContentPayload {
  notification: {
    title?: PreviewContentNode;
    body: PreviewContentNode;
    groupingKey?: PreviewContentNode;
  };
  message?: {
    type: 'group' | 'dm';
    timestamp: number;
    senderId: string;
    conversationTitle?: PreviewContentNode;
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

  const { stringLiteral: lit, channelTitle, userNickname } = PreviewContentNode;

  const source = getSourceForEvent(ev);
  const contentSummary = inlineSummary(content);

  const is = ActivityIncomingEvent.is;
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
      return {
        notification: {
          body: lit(contentSummary),
          groupingKey: lit(sourceToString(source, true)),
        },
      };

    case is(ev, 'dm-post'): {
      const { sent, author } = getIdParts(ev['dm-post'].key.id);
      return {
        notification: {
          body: lit(contentSummary),
          groupingKey: lit(sourceToString(source, true)),
        },
        message: {
          type: 'dm',
          timestamp: sent,
          senderId: author,
          conversationTitle: userNickname(author),
          messageText: lit(contentSummary),
        },
      };
    }

    default: {
      ((_x: never) => {
        throw new Error(`Unrecognized activity event type: ${ev}`);
      })(ev);
    }
  }
}
