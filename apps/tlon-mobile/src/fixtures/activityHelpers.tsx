import { PostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import { ExtendedEventType } from '@tloncorp/shared/dist/urbit';

import { exampleContacts, postsByType } from './contentHelpers';
import { group as fakeGroup, tlonLocalIntros } from './fakeData';

function exampleContact(i: number) {
  return Object.values(exampleContacts)[
    i % Object.values(exampleContacts).length
  ];
}

const groupDmChannel: db.Channel = {
  id: '0v4.00000.qcon2.pk30o.idqbo.qjuv7',
  type: 'groupDm',
} as const;

const dmChannel: db.Channel = {
  id: '~fabled-faster',
  type: 'dm',
};

export const groupJoinRequestActivity = (
  count: number,
  extraProps?: GroupJoinRequestEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) => {
      return groupJoinRequestEvent({
        contact: exampleContact(i),
        ...extraProps,
      });
    })
  );

export const groupThreadReplyActivity = (
  count: number,
  extraProps?: GroupThreadReplyEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      groupThreadReplyEvent({
        ...extraProps,
        contact: exampleContact(i),
      })
    )
  );

export const groupPostActivity = (
  count: number,
  extraProps?: GroupPostEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      groupPostEvent({
        contact: exampleContact(i),
        ...extraProps,
      })
    )
  );

export const groupPostWithRandomContentActivity = (
  count: number,
  extraProps?: GroupPostEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      groupPostEvent({
        contact: exampleContact(i),
        post: Object.values(postsByType)[i % Object.values(postsByType).length],
        ...extraProps,
      })
    )
  );

export const dmPostActivity = (count: number, extraProps?: DmPostEventParams) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      dmPostEvent({
        contact: exampleContact(i),
        ...extraProps,
      })
    )
  );

export const groupDmPostActivity = (
  count: number,
  extraProps?: GroupDmPostEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      groupDmPostEvent({
        contact: exampleContact(i),
        ...extraProps,
      })
    )
  );

export const groupDmThreadReplyActivity = (
  count: number,
  extraProps?: ThreadReplyEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      groupDmThreadReplyEvent({
        contact: exampleContact(i),
        ...extraProps,
      })
    )
  );

export const flagPostActivity = (
  count: number,
  extraProps?: PostFlagEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      postFlagEvent({
        contact: exampleContact(i),
        ...extraProps,
      })
    )
  );

export const flagReplyActivity = (
  count: number,
  extraProps?: ReplyFlagEventParams
) =>
  summary(
    ...Array.from({ length: count }, (v, i) =>
      replyFlagEvent({ contact: exampleContact(i), ...extraProps })
    )
  );

export const activityItems = {
  groupJoinRequest: groupJoinRequestActivity,
  groupPost: groupPostActivity,
  groupPostWithRandomContent: groupPostWithRandomContentActivity,
  groupThreadReply: groupThreadReplyActivity,
  groupDmPost: groupDmPostActivity,
  groupDmThreadReply: groupDmThreadReplyActivity,
  dmPost: dmPostActivity,
  flagPost: flagPostActivity,
  flagReply: flagReplyActivity,
};

function summary(...events: db.ActivityEvent[]): logic.SourceActivityEvents {
  return logic.toSourceActivityEvents(events)[0];
}

interface PostFlagEventParams {
  group?: db.Group;
  post?: db.Post;
  channel?: db.Channel;
  contact?: db.Contact;
}

function postFlagEvent({
  group = fakeGroup,
  channel = tlonLocalIntros,
  post = postsByType.text,
  contact = exampleContacts.fabledFaster,
}: PostFlagEventParams): db.ActivityEvent {
  return postEvent({
    group,
    channel,
    post,
    sourceId: `group/${group.id}`,
    contact,
    type: 'flag-post',
  });
}

interface ReplyFlagEventParams {
  group?: db.Group;
  post?: db.Post;
  parent?: db.Post;
  channel?: db.Channel;
  contact?: db.Contact;
}

function replyFlagEvent({
  group = fakeGroup,
  channel = tlonLocalIntros,
  post = postsByType.text,
  parent = postsByType.text,
  contact = exampleContacts.fabledFaster,
}: ReplyFlagEventParams): db.ActivityEvent {
  return postEvent({
    group,
    channel,
    post,
    parent,
    sourceId: `group/${group.id}`,
    contact,
    type: 'flag-reply',
  });
}

interface ThreadReplyEventParams {
  channel?: db.Channel;
  post?: db.Post;
  parent?: db.Post;
  contact?: db.Contact;
  content?: PostContent;
  isMention?: boolean;
}

function groupDmThreadReplyEvent({
  channel = groupDmChannel,
  post = postsByType.text,
  parent = postsByType.code,
  contact = exampleContacts.fabledFaster,
  isMention = false,
}: ThreadReplyEventParams): db.ActivityEvent {
  return postEvent({
    channel,
    post,
    parent,
    contact,
    sourceId: `dm-thread/${channel.id}/${parent.id}`,
    type: 'reply',
    bucketId: isMention ? 'replies' : 'mentions',
    isMention,
  });
}

type GroupThreadReplyEventParams = ThreadReplyEventParams & {
  group?: db.Group;
};

function groupThreadReplyEvent({
  group = fakeGroup,
  channel = tlonLocalIntros,
  post = postsByType.text,
  parent = postsByType.code,
  contact = exampleContacts.fabledFaster,
  isMention = false,
}: GroupThreadReplyEventParams): db.ActivityEvent {
  return postEvent({
    group,
    channel,
    post,
    parent,
    contact,
    sourceId: `thread/${channel.id}`,
    type: 'reply',
    bucketId: isMention ? 'replies' : 'mentions',
    isMention,
  });
}

interface GroupJoinRequestEventParams {
  group?: db.Group;
  contact?: db.Contact;
}

function groupJoinRequestEvent({
  group = fakeGroup,
  contact = exampleContacts.fabledFaster,
}: GroupJoinRequestEventParams): db.ActivityEvent {
  return {
    id: randomId(),
    bucketId: 'all',
    sourceId: `group/${group.id}`,
    type: 'group-ask',
    timestamp: Date.now(),
    groupId: group.id,
    group,
    groupEventUserId: contact.id,
  };
}

interface DmPostEventParams {
  channel?: db.Channel;
  contact?: db.Contact;
  post?: db.Post;
}

function dmPostEvent({
  channel = dmChannel,
  contact = exampleContacts.fabledFaster,
  post = postsByType.text,
}: DmPostEventParams) {
  return postEvent({
    channel,
    contact,
    post,
    sourceId: `dm/${channel.id}`,
    type: 'post',
  });
}

type GroupDmPostEventParams = DmPostEventParams & {
  isMention?: boolean;
};

function groupDmPostEvent({
  channel = groupDmChannel,
  contact = exampleContacts.fabledFaster,
  post = postsByType.text,
  isMention,
}: GroupDmPostEventParams) {
  return postEvent({
    channel,
    contact,
    post,
    sourceId: `group-dm/${channel.id}`,
    type: 'post',
    bucketId: isMention ? 'mentions' : 'all',
    isMention,
  });
}

type GroupPostEventParams = GroupDmPostEventParams & {
  group?: db.Group;
};

function groupPostEvent({
  group = fakeGroup,
  channel = tlonLocalIntros,
  post = postsByType.text,
  contact = exampleContacts.fabledFaster,
  isMention,
}: GroupPostEventParams) {
  return postEvent({
    group,
    channel,
    contact,
    post,
    sourceId: `group/${group.id}`,
    type: 'post',
    bucketId: isMention ? 'mentions' : 'all',
    isMention,
  });
}

interface PostEventParams {
  group?: db.Group | null;
  channel: db.Channel;
  contact: db.Contact;
  post: db.Post;
  sourceId: string;
  type: ExtendedEventType;
  parent?: db.Post | null;
  isMention?: boolean;
  bucketId?: db.ActivityBucket;
}

function postEvent({
  group,
  channel,
  contact,
  post,
  sourceId,
  type,
  parent,
  isMention,
  bucketId = 'all',
}: PostEventParams): db.ActivityEvent {
  return {
    id: randomId(),
    bucketId,
    sourceId,
    type,
    timestamp: Date.now(),
    postId: post.id,
    post: {
      ...post,
      authorId: contact.id,
      author: contact,
      groupId: group?.id,
      group,
      channelId: channel.id,
      channel,
    },
    authorId: contact.id,
    author: contact,
    parentId: parent?.id,
    parent: parent,
    channelId: channel.id,
    channel,
    groupId: group?.id,
    group,
    content: JSON.parse(post.content as string) as PostContent,
    shouldNotify: true,
    isMention: !!isMention,
  };
}

function randomId() {
  return Math.random().toString(36).substring(2);
}
