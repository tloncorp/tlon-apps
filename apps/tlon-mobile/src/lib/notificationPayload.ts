import { getCanonicalPostId } from '@tloncorp/api/client/apiUtils';
import * as ub from '@tloncorp/api/urbit';
import { ActivityIncomingEvent } from '@tloncorp/api/urbit';

export interface BaseNotificationData {
  meta: { errorsFromExtension?: unknown };
}

export interface PostInfo {
  id: string;
  authorId: string;
  isDm: boolean;
}

export interface MinimalNotificationData extends BaseNotificationData {
  type?: undefined;
  channelId: string;
  postInfo: PostInfo | null;
}

export interface DMInviteNotificationData extends BaseNotificationData {
  type: 'dmInvite';
  channelId: string;
  whomType: 'ship' | 'club';
}

export interface UnrecognizedNotificationData extends BaseNotificationData {
  type: 'unrecognized';
}

export interface GroupJoinRequestNotificationData extends BaseNotificationData {
  type: 'groupJoinRequest';
  groupId: string;
}

export interface GroupInviteNotificationData extends BaseNotificationData {
  type: 'groupInvite';
  groupId: string;
}

export interface ContactMatchedNotificationData extends BaseNotificationData {
  type: 'contactMatched';
  contactId: string;
}

export interface ContactsMatchedNotificationData extends BaseNotificationData {
  type: 'contactsMatched';
}

export type NotificationData =
  | MinimalNotificationData
  | DMInviteNotificationData
  | GroupJoinRequestNotificationData
  | GroupInviteNotificationData
  | ContactMatchedNotificationData
  | ContactsMatchedNotificationData
  | UnrecognizedNotificationData;

export type ProcessableNotificationData = Exclude<
  NotificationData,
  UnrecognizedNotificationData
>;

type NotificationPayload = Record<string, unknown>;

function getActivityEvent(jsonString: string): ub.ActivityEvent | null {
  try {
    const parsed = JSON.parse(jsonString) as { event?: unknown };
    if (
      parsed == null ||
      typeof parsed !== 'object' ||
      !('event' in parsed) ||
      parsed.event == null
    ) {
      return null;
    }

    return parsed.event as ub.ActivityEvent;
  } catch {
    return null;
  }
}

export function parseNotificationPayload(
  payload: unknown
): NotificationData | null {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }

  const notificationPayload = payload as NotificationPayload;
  const baseNotificationData: BaseNotificationData = {
    meta: {
      errorsFromExtension:
        notificationPayload.notificationServiceExtensionErrors,
    },
  };

  if (
    notificationPayload.type === 'contactMatched' &&
    typeof notificationPayload.contactId === 'string'
  ) {
    return {
      ...baseNotificationData,
      type: 'contactMatched',
      contactId: notificationPayload.contactId,
    };
  }

  if (notificationPayload.type === 'contactsMatched') {
    return {
      ...baseNotificationData,
      type: 'contactsMatched',
    };
  }

  if (
    notificationPayload.activityEventJsonString != null &&
    typeof notificationPayload.activityEventJsonString === 'string'
  ) {
    const ev = getActivityEvent(notificationPayload.activityEventJsonString);
    if (ev == null) {
      return null;
    }
    const is = ActivityIncomingEvent.is;

    const authorAndId = (id: string) => ({
      id: getCanonicalPostId(id),
      authorId: ub.getIdParts(id).author,
    });

    const dmTarget = (
      info: Pick<ub.DmPostEvent['dm-post'], 'whom'>,
      { parent }: { parent?: ub.DmReplyEvent['dm-reply']['parent'] } = {}
    ): MinimalNotificationData => ({
      ...baseNotificationData,
      channelId: 'ship' in info.whom ? info.whom.ship : info.whom.club,
      postInfo:
        parent == null
          ? null
          : {
              ...authorAndId(parent.id),
              isDm: false,
            },
    });

    const channelPostTarget = (
      info: Pick<ub.PostEvent['post'], 'channel'>,
      { parent }: { parent?: ub.ReplyEvent['reply']['parent'] } = {}
    ): MinimalNotificationData => ({
      ...baseNotificationData,
      channelId: info.channel,
      postInfo:
        parent == null
          ? null
          : {
              ...authorAndId(parent.id),
              isDm: false,
            },
    });

    const groupAskTarget = (info: { group: string }): NotificationData => {
      return {
        ...baseNotificationData,
        type: 'groupJoinRequest',
        groupId: info.group,
      };
    };

    try {
      switch (true) {
        case is(ev, 'dm-post'):
          return dmTarget(ev['dm-post']);

        case is(ev, 'dm-reply'):
          return dmTarget(ev['dm-reply'], { parent: ev['dm-reply'].parent });

        case is(ev, 'post'):
          return channelPostTarget(ev.post);

        case is(ev, 'reply'):
          return channelPostTarget(ev.reply, { parent: ev.reply.parent });

        case is(ev, 'react'):
          // navigate to the reacted-to content: the thread if it's a reply
          // react, otherwise the channel
          return channelPostTarget(ev.react, {
            parent: ev.react.parent ?? undefined,
          });

        case is(ev, 'dm-react'):
          return dmTarget(ev['dm-react'], {
            parent: ev['dm-react'].parent ?? undefined,
          });

        case is(ev, 'group-ask'):
          return groupAskTarget(ev['group-ask']);

        case is(ev, 'group-invite'): {
          const { group } = ev['group-invite'];
          if (typeof group !== 'string') {
            return null;
          }
          return {
            ...baseNotificationData,
            type: 'groupInvite',
            groupId: group,
          };
        }

        case is(ev, 'dm-invite'): {
          const whom = ev['dm-invite'];
          if ('ship' in whom) {
            return {
              ...baseNotificationData,
              type: 'dmInvite',
              channelId: whom.ship,
              whomType: 'ship',
            };
          }
          return {
            ...baseNotificationData,
            type: 'dmInvite',
            channelId: whom.club,
            whomType: 'club',
          };
        }

        case is(ev, 'group-join'):
        // fallthrough
        case is(ev, 'group-kick'):
        // fallthrough
        case is(ev, 'group-role'):
        // fallthrough
        case is(ev, 'flag-post'):
        // fallthrough
        case is(ev, 'contact'):
        // fallthrough
        case is(ev, 'flag-reply'):
          return null;

        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  return {
    ...baseNotificationData,
    type: 'unrecognized',
  };
}
