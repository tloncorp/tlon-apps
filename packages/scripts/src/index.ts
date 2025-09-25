import { parseContactUpdateEvent } from '@tloncorp/shared/api';
import { getTextContent } from '@tloncorp/shared/logic';
import type * as ub from '@tloncorp/shared/urbit';
import {
  ActivityIncomingEvent,
  getIdParts,
  getSourceForEvent,
  sourceToString,
} from '@tloncorp/shared/urbit/activity';

type PreviewContentNode =
  | { type: 'channelTitle'; channelId: string }
  | { type: 'groupTitle'; groupId: string }
  | {
      /**
       * A user-friendly representation of a post source, usually a channel in a
       * group; e.g. "My Group: Main channel", or, if `groupId` points to a
       * single-channel group, just "My Group".
       */
      type: 'postSource';
      channelId: string;
      groupId: string;
    }
  | { type: 'gangTitle'; gangId: string }
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
  export function postSource(opts: {
    groupId: string;
    channelId: string;
  }): PreviewContentNode {
    return { type: 'postSource', ...opts };
  }
  export function userNickname(ship: string): PreviewContentNode {
    return { type: 'userNickname', ship };
  }
  export function groupTitle(groupId: string): PreviewContentNode {
    return { type: 'groupTitle', groupId };
  }
  export function gangTitle(gangId: string): PreviewContentNode {
    return { type: 'gangTitle', gangId };
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
    gangTitle,
    groupTitle,
    stringLiteral: lit,
    channelTitle,
    userNickname,
    concatenateAll: concat,
    postSource,
  } = PreviewContentNode;
  const source = getSourceForEvent(ev);

  function buildMessageNotification(
    info: Pick<ub.PostEvent['post'], 'key' | 'content'>
  ) {
    const { sent, author } = getIdParts(info.key.id);
    const contentSummary = getTextContent(info.content);
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
    info: Pick<ub.PostEvent['post'], 'key' | 'channel' | 'content' | 'group'>
  ): PreviewContentPayload {
    const base = buildMessageNotification(info);
    const sourceTitle = postSource({
      groupId: info.group,
      channelId: info.channel,
    });
    return {
      ...base,
      notification: {
        ...base.notification,
        title: sourceTitle,
      },
      message: {
        ...base.message,
        type: 'group',
        conversationTitle: sourceTitle,
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
            gangTitle(ev['group-invite'].group),
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
            userNickname(ev['group-join'].ship),
            lit(' joined '),
            groupTitle(ev['group-join'].group),
          ]),
        },
      };

    case is(ev, 'group-kick'):
      return {
        notification: {
          body: concat([
            userNickname(ev['group-kick'].ship),
            lit(' left '),
            groupTitle(ev['group-kick'].group),
          ]),
        },
      };

    case is(ev, 'group-role'):
      return {
        notification: {
          body: concat([
            userNickname(ev['group-role'].ship),
            lit(` has a new role (${ev['group-role'].role}) in `),
            groupTitle(ev['group-role'].group),
          ]),
        },
      };

    case is(ev, 'flag-post'):
      return {
        notification: {
          body: concat([
            lit('Someone flagged a post in '),
            groupTitle(ev['flag-post'].group),
          ]),
        },
      };

    case is(ev, 'contact'):
      return {
        notification: {
          body: concat([
            userNickname(ev.contact.who),
            lit(
              ` updated their ${parseContactUpdateEvent('placeholder-id', ev)?.contactUpdateType || 'profile'}`
            ),
          ]),
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
