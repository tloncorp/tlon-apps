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
  | { type: 'groupTitle'; groupId: string }
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
  export function concatenateAll(
    nodes: PreviewContentNode[]
  ): PreviewContentNode {
    if (nodes.length === 0) {
      throw new Error('Must provide at least one node');
    }
    if (nodes.length === 1) {
      return nodes[0];
    }
    return nodes.reduce((acc, node) => concatenateStrings(acc, node));
  }
  export function channelTitle(channelId: string): PreviewContentNode {
    return { type: 'channelTitle', channelId };
  }
  export function userNickname(ship: string): PreviewContentNode {
    return { type: 'userNickname', ship };
  }
  export function groupTitle(groupId: string): PreviewContentNode {
    return { type: 'groupTitle', groupId };
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
  const {
    groupTitle,
    stringLiteral: lit,
    channelTitle,
    userNickname,
    concatenateAll: concat,
  } = PreviewContentNode;
  const source = getSourceForEvent(ev);

  function buildMessageNotification(
    info: Pick<ub.PostEvent['post'], 'key' | 'content'>
  ) {
    const { sent, author } = getIdParts(info.key.id);
    const contentSummary = inlineSummary(info.content);
    return {
      notification: {
        body: lit(contentSummary),
        groupingKey: lit(sourceToString(source, true)),
      },
      message: {
        timestamp: sent,
        senderId: author,
        messageText: lit(contentSummary),
      },
    };
  }

  function buildPostNotification(
    info: Pick<ub.PostEvent['post'], 'key' | 'channel' | 'content'>
  ): PreviewContentPayload {
    const base = buildMessageNotification(info);
    return {
      ...base,
      notification: {
        ...base.notification,
        title: channelTitle(info.channel),
      },
      message: {
        ...base.message,
        type: 'group',
        conversationTitle: channelTitle(info.channel),
      },
    };
  }
  function buildDmNotification(
    info: Pick<ub.DmPostEvent['dm-post'], 'key' | 'content'>
  ): PreviewContentPayload {
    const { author } = getIdParts(info.key.id);

    const base = buildMessageNotification(info);
    return {
      ...base,
      message: {
        ...base.message,
        type: 'dm',
        conversationTitle: userNickname(author),
      },
    };
  }

  const is = ActivityIncomingEvent.is;
  switch (true) {
    case is(ev, 'post'):
      return buildPostNotification(ev.post);
    case is(ev, 'reply'):
      return buildPostNotification(ev.reply);
    case is(ev, 'dm-post'):
      return buildDmNotification(ev['dm-post']);
    case is(ev, 'dm-reply'):
      return buildDmNotification(ev['dm-reply']);

    case is(ev, 'dm-invite'):
      return {
        notification: {
          body:
            'ship' in ev['dm-invite']
              ? concat([
                  lit('You have a new DM from '),
                  userNickname(ev['dm-invite'].ship),
                ])
              : lit('You have a new DM'),
        },
      };

    case is(ev, 'group-invite'):
      return {
        notification: {
          body: concat([
            lit('You were invited to '),
            groupTitle(ev['group-invite'].group),
            lit(' by '),
            userNickname(ev['group-invite'].ship),
          ]),
        },
      };

    case is(ev, 'group-ask'):
      return {
        notification: {
          body: concat([
            userNickname(ev['group-ask'].ship),
            lit(' asked to join '),
            groupTitle(ev['group-ask'].group),
          ]),
        },
      };

    case is(ev, 'group-join'):
      return {
        notification: {
          body: concat([
            userNickname(ev['group-join'].ship), // TODO: is this correct?
            lit(' accepted your request to join '),
            groupTitle(ev['group-join'].group),
          ]),
        },
      };

    case is(ev, 'group-kick'):
      return {
        notification: {
          body: concat([
            userNickname(ev['group-kick'].ship), // TODO: is this correct?
            lit(' kicked you from '),
            groupTitle(ev['group-kick'].group),
          ]),
        },
      };

    case is(ev, 'group-role'):
      return {
        notification: {
          body: concat([
            userNickname(ev['group-role'].ship), // TODO: is this correct?
            lit(' changed your role in '),
            groupTitle(ev['group-role'].group),
            lit(` to ${ev['group-role'].role}`),
          ]),
        },
      };

    case is(ev, 'flag-post'):
      return {
        notification: {
          body: concat([
            lit('Your post was flagged in'), // TODO: is this correct? (is this your post or someone else's?)
            groupTitle(ev['flag-post'].group),
          ]),
        },
      };

    case is(ev, 'contact'):
      return {
        notification: {
          body: lit('New contact'), // TODO: ???
        },
      };

    case is(ev, 'flag-reply'):
      // fallback notification
      return {
        notification: {
          body: lit('You received a notification'),
        },
      };

    default: {
      ((_x: never) => {
        throw new Error(`Unrecognized activity event type: ${ev}`);
      })(ev);
    }
  }
}
