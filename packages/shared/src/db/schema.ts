import { SQL, relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { ChannelContentConfiguration } from '../api';
import { ExtendedEventType, NotificationLevel, Rank } from '../urbit';

const boolean = (name: string) => {
  return integer(name, { mode: 'boolean' });
};

const timestamp = (name: string) => {
  return integer(name);
};

const metaFields = {
  iconImage: text('icon_image'),
  iconImageColor: text('icon_image_color'),
  coverImage: text('cover_image'),
  coverImageColor: text('cover_image_color'),
  title: text('title'),
  description: text('description'),
};

export const SETTINGS_SINGLETON_KEY = 'settings';
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default(SETTINGS_SINGLETON_KEY),
  theme: text('theme'),
  disableAppTileUnreads: boolean('disable_app_tile_unreads'),
  disableAvatars: boolean('disable_avatars'),
  disableRemoteContent: boolean('disable_remote_content'),
  disableSpellcheck: boolean('disable_spellcheck'),
  disableNicknames: boolean('disable_nicknames'),
  orderedGroupPins: text('ordered_group_pins', { mode: 'json' }),
  sideBarSort: text('side_bar_sort').$type<
    'alphabetical' | 'arranged' | 'recent'
  >(),
  groupSideBarSort: text('group_side_bar_sort', { mode: 'json' }),
  showActivityMessage: boolean('show_activity_message'),
  // DEPRECATED: use `enableTelemetry` instead, retained for setting migration
  logActivity: boolean('log_activity'),
  enableTelemetry: boolean('enable_telemetry'),
  analyticsId: text('analytics_id'),
  seenWelcomeCard: boolean('seen_welcome_card'),
  newGroupFlags: text('new_group_flags', { mode: 'json' }),
  groupsNavState: text('groups_nav_state'),
  messagesNavState: text('messages_nav_state'),
  messagesFilter: text('messages_filter'),
  gallerySettings: text('gallery_settings'),
  notebookSettings: text('notebook_settings', { mode: 'json' }),
  activitySeenTimestamp: timestamp('activity_seen_timestamp'),
  completedWayfindingSplash: boolean('completed_wayfinding_splash'),
  completedWayfindingTutorial: boolean('completed_wayfinding_tutorial'),
  disableTlonInfraEnhancement: boolean('disable_tlon_infra_enhancement'),
  testSetting: text('test_setting'),
});

export const systemContacts = sqliteTable(
  'system_contacts',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    phoneNumber: text('phone_number'),
    email: text('email'),
    contactId: text('contact_id'),
  },
  (table) => {
    return {
      contactIdIndex: index('system_contacts_contact_id_index').on(
        table.contactId
      ),
    };
  }
);

export const systemContactRelations = relations(
  systemContacts,
  ({ one, many }) => ({
    contact: one(contacts, {
      fields: [systemContacts.contactId],
      references: [contacts.id],
    }),
    sentInvites: many(systemContactSentInvites),
  })
);

export const systemContactSentInvites = sqliteTable(
  'system_contact_sent_invites',
  {
    invitedTo: text('invited_to'),
    systemContactId: text('system_contact_id'),
    invitedAt: timestamp('invited_at'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.invitedTo, table.systemContactId],
    }),
    systemContactIdIndex: index(
      'system_contact_sent_invites_system_contact_id_index'
    ).on(table.systemContactId),
  })
);

export const systemContactSentInviteRelations = relations(
  systemContactSentInvites,
  ({ one }) => ({
    systemContact: one(systemContacts, {
      fields: [systemContactSentInvites.systemContactId],
      references: [systemContacts.id],
    }),
  })
);

export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),

    peerNickname: text('peerNickname'),
    customNickname: text('customNickname'),
    nickname: text('nickname').generatedAlwaysAs(
      (): SQL =>
        sql`COALESCE(${contacts.customNickname}, ${contacts.peerNickname})`,
      { mode: 'stored' }
    ),

    peerAvatarImage: text('peerAvatarImage'),
    customAvatarImage: text('customAvatarImage'),
    avatarImage: text('avatarImage').generatedAlwaysAs(
      (): SQL =>
        sql`COALESCE(${contacts.customAvatarImage}, ${contacts.peerAvatarImage})`,
      { mode: 'stored' }
    ),

    bio: text('bio'),
    status: text('status'),
    color: text('color'),
    coverImage: text('coverImage'),
    isBlocked: boolean('blocked'),
    isContact: boolean('isContact'),
    isContactSuggestion: boolean('isContactSuggestion'),
    systemContactId: text('systemContactId'),
  },
  (table) => {
    return {
      systemContactIdIndex: index('contacts_system_contact_id_index').on(
        table.systemContactId
      ),
    };
  }
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  pinnedGroups: many(contactGroups),
  attestations: many(contactAttestations),
  systemContact: one(systemContacts, {
    fields: [contacts.systemContactId],
    references: [systemContacts.id],
  }),
}));

export const contactGroups = sqliteTable(
  'contact_group_pins',
  {
    contactId: text('contact_id')
      .references(() => contacts.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.contactId, table.groupId] }),
      contactIdIndex: index('contact_group_pins_contact_id_index').on(
        table.contactId
      ),
      groupIdIndex: index('contact_group_pins_group_id_index').on(
        table.groupId
      ),
    };
  }
);

export const contactGroupRelations = relations(contactGroups, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactGroups.contactId],
    references: [contacts.id],
  }),
  group: one(groups, {
    fields: [contactGroups.groupId],
    references: [groups.id],
  }),
}));

export const contactAttestations = sqliteTable(
  'contact_attestations',
  {
    contactId: text('contact_id')
      .references(() => contacts.id, { onDelete: 'cascade' })
      .notNull(),
    attestationId: text('attestation_id')
      .references(() => attestations.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.contactId, table.attestationId],
      }),
      contactIdIndex: index('contact_attestations_contact_id_index').on(
        table.contactId
      ),
      attestationIdIndex: index('contact_attestations_attestation_id_index').on(
        table.attestationId
      ),
    };
  }
);

export const contactAttestationRelations = relations(
  contactAttestations,
  ({ one }) => ({
    contact: one(contacts, {
      fields: [contactAttestations.contactId],
      references: [contacts.id],
    }),
    attestation: one(attestations, {
      fields: [contactAttestations.attestationId],
      references: [attestations.id],
    }),
  })
);

export type AttestationType = 'phone' | 'node' | 'twitter' | 'dummy';
export type AttestationDiscoverability = 'public' | 'verified' | 'hidden';
export type AttestationStatus = 'waiting' | 'pending' | 'verified';
export const attestations = sqliteTable(
  'attestations',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    type: text('type').$type<AttestationType>().notNull(),
    value: text('value'),
    initiatedAt: timestamp('initiated_at'),
    discoverability: text('discoverability')
      .$type<AttestationDiscoverability>()
      .notNull(),
    status: text('status').$type<AttestationStatus>().notNull(),
    statusMessage: text('status_message'),
    contactId: text('contact_id').notNull(),
    providerUrl: text('provider__url'),
    provingTweetId: text('proving_tweet_id'),
    signature: text('signature'),
  },
  (table) => {
    return {
      contactIdIndex: index('attestations_contact_id_index').on(
        table.contactId
      ),
    };
  }
);

export const attestationRelations = relations(attestations, ({ one }) => ({
  contact: one(contacts, {
    fields: [attestations.contactId],
    references: [contacts.id],
  }),
}));

export const channelUnreads = sqliteTable(
  'channel_unreads',
  {
    channelId: text('channel_id').primaryKey(),
    type: text('type').$type<'channel' | 'dm'>().notNull(),
    notify: boolean('notify').notNull(),
    count: integer('count').notNull(),
    countWithoutThreads: integer('count_without_threads').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    firstUnreadPostId: text('first_unread_post_id'),
    firstUnreadPostReceivedAt: timestamp('first_unread_post_received_at'),
  },
  (table) => {
    return {
      channelIdIndex: index('channel_unreads_channel_id_index').on(
        table.channelId
      ),
    };
  }
);

export const unreadsRelations = relations(channelUnreads, ({ one, many }) => ({
  channel: one(channels, {
    fields: [channelUnreads.channelId],
    references: [channels.id],
  }),
  threadUnreads: many(threadUnreads),
}));

export const threadUnreads = sqliteTable(
  'thread_unreads',
  {
    channelId: text('channel_id'),
    threadId: text('thread_id'),
    notify: boolean('notify'),
    count: integer('count'),
    updatedAt: timestamp('updated_at').notNull(),
    firstUnreadPostId: text('first_unread_post_id'),
    firstUnreadPostReceivedAt: timestamp('first_unread_post_received_at'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.channelId, table.threadId],
    }),
  })
);

export const threadUnreadsRelations = relations(threadUnreads, ({ one }) => ({
  channel: one(channels, {
    fields: [threadUnreads.channelId],
    references: [channels.id],
  }),
  channelUnread: one(channelUnreads, {
    fields: [threadUnreads.channelId],
    references: [channelUnreads.channelId],
  }),
}));

export const groupUnreads = sqliteTable('group_unreads', {
  groupId: text('group_id').primaryKey(),
  notify: boolean('notify'),
  count: integer('count'),
  notifyCount: integer('notify_count'),
  updatedAt: timestamp('updated_at').notNull(),
});

export const groupUnreadsRelations = relations(groupUnreads, ({ one }) => ({
  group: one(groups, {
    fields: [groupUnreads.groupId],
    references: [groups.id],
  }),
}));

export const BASE_UNREADS_SINGLETON_KEY = 'base_unreads';
export const baseUnreads = sqliteTable('base_unreads', {
  id: text('id').primaryKey().default(BASE_UNREADS_SINGLETON_KEY),
  notify: boolean('notify'),
  count: integer('count'),
  notifyCount: integer('notify_count'),
  updatedAt: timestamp('updated_at').notNull(),
  notifTimestamp: text('notif_timestamp'), // used for ordering against notification identifiers (uid)
});

export type ActivityBucket = 'all' | 'mentions' | 'replies';
export const activityEvents = sqliteTable(
  'activity_events',
  {
    id: text('id').notNull(),
    bucketId: text('bucket_id').$type<ActivityBucket>().notNull(),
    sourceId: text('source_id').notNull(),
    type: text('type').$type<ExtendedEventType>().notNull(),
    timestamp: timestamp('timestamp').notNull(),
    postId: text('post_id'),
    authorId: text('author_id'),
    parentId: text('parent_id'),
    parentAuthorId: text('parent_author_id'),
    channelId: text('channel_id'),
    groupId: text('group_id'),
    isMention: boolean('is_mention'),
    shouldNotify: boolean('should_notify'),
    content: text('content', { mode: 'json' }),
    groupEventUserId: text('group_event_user_id'),
    contactUserId: text('contact_user_id'),
    contactUpdateType: text('contact_update_type'),
    contactUpdateValue: text('contact_update_value'),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.bucketId] }),
    };
  }
);

export const activityEventContactGroups = sqliteTable(
  'activity_event_contact_group_pins',
  {
    activityEventId: text('activity_event_id')
      .references(() => activityEvents.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.activityEventId, table.groupId] }),
      activityEventIdIndex: index(
        'activity_event_contact_groups_activity_event_id_index'
      ).on(table.activityEventId),
      groupIdIndex: index('activity_event_contact_groups_group_id_index').on(
        table.groupId
      ),
    };
  }
);

export const activityEventContactGroupRelations = relations(
  activityEventContactGroups,
  ({ one }) => ({
    activityEvent: one(activityEvents, {
      fields: [activityEventContactGroups.activityEventId],
      references: [activityEvents.id],
    }),
    group: one(groups, {
      fields: [activityEventContactGroups.groupId],
      references: [groups.id],
    }),
  })
);

export const activityRelations = relations(activityEvents, ({ one, many }) => ({
  post: one(posts, {
    fields: [activityEvents.postId],
    references: [posts.id],
  }),
  parent: one(posts, {
    fields: [activityEvents.parentId],
    references: [posts.id],
  }),
  channel: one(channels, {
    fields: [activityEvents.channelId],
    references: [channels.id],
  }),
  group: one(groups, {
    fields: [activityEvents.groupId],
    references: [groups.id],
  }),
  author: one(contacts, {
    fields: [activityEvents.authorId],
    references: [contacts.id],
  }),
  parentAuthor: one(contacts, {
    fields: [activityEvents.parentAuthorId],
    references: [contacts.id],
  }),
  groupEventUser: one(contacts, {
    fields: [activityEvents.groupEventUserId],
    references: [contacts.id],
  }),
  contactUpdateGroups: many(activityEventContactGroups),
}));

export type PinType = 'group' | 'channel' | 'dm' | 'groupDm';
export const pins = sqliteTable(
  'pins',
  {
    type: text('type').$type<PinType>().notNull(),
    index: integer('pin_index').notNull(),
    itemId: text('item_id').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.itemId] }),
    };
  }
);

export const pinRelations = relations(pins, ({ one }) => ({
  group: one(groups, {
    fields: [pins.itemId],
    references: [groups.id],
  }),
  channel: one(channels, {
    fields: [pins.itemId],
    references: [channels.id],
  }),
}));

export type GroupJoinStatus = 'joining' | 'errored';
export type GroupPrivacy = 'public' | 'private' | 'secret';

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  ...metaFields,
  privacy: text('privacy').$type<GroupPrivacy>(),
  haveInvite: boolean('have_invite'),
  haveRequestedInvite: boolean('have_requested_invite'),
  currentUserIsMember: boolean('current_user_is_member').notNull(),
  currentUserIsHost: boolean('current_user_is_host').notNull(),
  hostUserId: text('host_user_id').notNull(),
  isNew: boolean('is_new'),
  isPersonalGroup: boolean('is_personal_group').default(false),
  joinStatus: text('join_status').$type<GroupJoinStatus>(),
  lastPostId: text('last_post_id'),
  lastPostAt: timestamp('last_post_at'),
  syncedAt: timestamp('synced_at'),
  pendingMembersDismissedAt: timestamp('pending_members_dismissed_at'),
});

export const groupsRelations = relations(groups, ({ one, many }) => ({
  pin: one(pins),
  roles: many(groupRoles),
  members: many(chatMembers),
  joinRequests: many(groupJoinRequests),
  bannedMembers: many(groupMemberBans),
  navSections: many(groupNavSections),
  flaggedPosts: many(groupFlaggedPosts),
  channels: many(channels),
  posts: many(posts),
  lastPost: one(posts, {
    fields: [groups.lastPostId],
    references: [posts.id],
  }),
  unread: one(groupUnreads, {
    fields: [groups.id],
    references: [groupUnreads.groupId],
  }),
  volumeSettings: one(volumeSettings, {
    fields: [groups.id],
    references: [volumeSettings.itemId],
  }),
}));

export const groupRoles = sqliteTable(
  'group_roles',
  {
    id: text('id').notNull(),
    groupId: text('group_id').references(() => groups.id, {
      onDelete: 'cascade',
    }),
    ...metaFields,
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.groupId, table.id] }),
      groupIdIndex: index('group_roles_group_id_index').on(table.groupId),
    };
  }
);

export const groupRolesRelations = relations(groupRoles, ({ one, many }) => ({
  members: many(chatMemberGroupRoles),
  group: one(groups, {
    fields: [groupRoles.groupId],
    references: [groups.id],
  }),
  writeChannels: many(channelWriters),
  readChannels: many(channelReaders),
}));

export const chatMembers = sqliteTable(
  'group_members',
  {
    membershipType: text('membership_type')
      .$type<'group' | 'channel'>()
      .notNull(),
    chatId: text('chat_id'),
    contactId: text('contact_id').notNull(),
    joinedAt: timestamp('joined_at'),
    status: text('status').$type<'invited' | 'joined'>(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.chatId, table.contactId],
      }),
      chatIdIndex: index('group_members_chat_id_index').on(table.chatId),
      contactIdIndex: index('group_members_contact_id_index').on(
        table.contactId
      ),
    };
  }
);

export const groupFlaggedPosts = sqliteTable(
  'group_flagged_posts',
  {
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    postId: text('post_id').notNull(),
    channelId: text('channel_id').notNull(),
    flaggedByContactId: text('flagged_by_contact_id').notNull(),
    flaggedAt: timestamp('flagged_at'),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.postId],
      }),
      groupIdIndex: index('group_flagged_posts_group_id_index').on(
        table.groupId
      ),
      postIdIndex: index('group_flagged_posts_post_id_index').on(table.postId),
      channelIdIndex: index('group_flagged_posts_channel_id_index').on(
        table.channelId
      ),
      flaggedByContactIdIndex: index(
        'group_flagged_posts_flagged_by_contact_id_index'
      ).on(table.flaggedByContactId),
    };
  }
);

export const groupFlaggedPostsRelations = relations(
  groupFlaggedPosts,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupFlaggedPosts.groupId],
      references: [groups.id],
    }),
    post: one(posts, {
      fields: [groupFlaggedPosts.postId],
      references: [posts.id],
    }),
    channel: one(channels, {
      fields: [groupFlaggedPosts.channelId],
      references: [channels.id],
    }),
    flaggedBy: one(contacts, {
      fields: [groupFlaggedPosts.flaggedByContactId],
      references: [contacts.id],
    }),
  })
);

export const groupMemberInvites = sqliteTable(
  'group_member_invites',
  {
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    contactId: text('contact_id').notNull(),
    invitedAt: timestamp('invited_at'),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.contactId],
      }),
      groupIdIndex: index('group_member_invites_group_id_index').on(
        table.groupId
      ),
      contactIdIndex: index('group_member_invites_contact_id_index').on(
        table.contactId
      ),
    };
  }
);

export const groupMemberInviteRelations = relations(
  groupMemberInvites,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupMemberInvites.groupId],
      references: [groups.id],
    }),
    contact: one(contacts, {
      fields: [groupMemberInvites.contactId],
      references: [contacts.id],
    }),
  })
);

export const groupJoinRequests = sqliteTable(
  'group_join_requests',
  {
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    contactId: text('contact_id').notNull(),
    requestedAt: timestamp('requested_at'),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.contactId],
      }),
      groupIdIndex: index('group_join_requests_group_id_index').on(
        table.groupId
      ),
      contactIdIndex: index('group_join_requests_contact_id_index').on(
        table.contactId
      ),
    };
  }
);

export const groupJoinRequestRelations = relations(
  groupJoinRequests,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupJoinRequests.groupId],
      references: [groups.id],
    }),
    contact: one(contacts, {
      fields: [groupJoinRequests.contactId],
      references: [contacts.id],
    }),
  })
);

export const groupMemberBans = sqliteTable(
  'group_member_bans',
  {
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    contactId: text('contact_id').notNull(),
    bannedAt: timestamp('banned_at'),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.contactId],
      }),
      groupIdIndex: index('group_member_bans_group_id_index').on(table.groupId),
      contactIdIndex: index('group_member_bans_contact_id_index').on(
        table.contactId
      ),
    };
  }
);

export const groupMemberBanRelations = relations(
  groupMemberBans,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupMemberBans.groupId],
      references: [groups.id],
    }),
    contact: one(contacts, {
      fields: [groupMemberBans.contactId],
      references: [contacts.id],
    }),
  })
);

export const groupRankBans = sqliteTable(
  'group_rank_bans',
  {
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    rankId: text('rank_id').notNull().$type<Rank>(),
    bannedAt: timestamp('banned_at'),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.rankId],
      }),
      groupIdIndex: index('group_rank_bans_group_id_index').on(table.groupId),
    };
  }
);

export const groupRankBanRelations = relations(groupRankBans, ({ one }) => ({
  group: one(groups, {
    fields: [groupRankBans.groupId],
    references: [groups.id],
  }),
}));

export const channelReaders = sqliteTable(
  'channel_readers',
  {
    channelId: text('channel_id').notNull(),
    roleId: text('role_id').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.channelId, table.roleId],
      }),
      channelIdIndex: index('channel_readers_channel_id_index').on(
        table.channelId
      ),
      roleIdIndex: index('channel_readers_role_id_index').on(table.roleId),
    };
  }
);

export const channelReaderRelations = relations(channelReaders, ({ one }) => {
  return {
    channel: one(channels, {
      fields: [channelReaders.channelId],
      references: [channels.id],
    }),
    role: one(groupRoles, {
      fields: [channelReaders.roleId],
      references: [groupRoles.id],
    }),
  };
});

export const channelWriters = sqliteTable(
  'channel_writers',
  {
    channelId: text('channel_id').notNull(),
    roleId: text('role_id').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.channelId, table.roleId],
      }),
      channelIdIndex: index('channel_writers_channel_id_index').on(
        table.channelId
      ),
      roleIdIndex: index('channel_writers_role_id_index').on(table.roleId),
    };
  }
);

export const channelWriterRelations = relations(channelWriters, ({ one }) => {
  return {
    channel: one(channels, {
      fields: [channelWriters.channelId],
      references: [channels.id],
    }),
    role: one(groupRoles, {
      fields: [channelWriters.roleId],
      references: [groupRoles.id],
    }),
  };
});

export const chatMembersRelations = relations(chatMembers, ({ one, many }) => ({
  roles: many(chatMemberGroupRoles),
  group: one(groups, {
    fields: [chatMembers.chatId],
    references: [groups.id],
  }),
  channel: one(channels, {
    fields: [chatMembers.chatId],
    references: [channels.id],
  }),
  contact: one(contacts, {
    fields: [chatMembers.contactId],
    references: [contacts.id],
  }),
}));

export const chatMemberGroupRoles = sqliteTable(
  'chat_member_roles',
  {
    groupId: text('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    contactId: text('contact_id').notNull(),
    roleId: text('role_id').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.contactId, table.roleId],
      }),
      groupIdIndex: index('chat_member_roles_group_id_index').on(table.groupId),
      contactIdIndex: index('chat_member_roles_contact_id_index').on(
        table.contactId
      ),
      roleIdIndex: index('chat_member_roles_role_id_index').on(table.roleId),
    };
  }
);

export const chatMemberRolesRelations = relations(
  chatMemberGroupRoles,
  ({ one }) => ({
    groupMember: one(chatMembers, {
      fields: [chatMemberGroupRoles.groupId, chatMemberGroupRoles.contactId],
      references: [chatMembers.chatId, chatMembers.contactId],
    }),
    groupRole: one(groupRoles, {
      fields: [chatMemberGroupRoles.groupId, chatMemberGroupRoles.roleId],
      references: [groupRoles.groupId, groupRoles.id],
    }),
  })
);

export const groupNavSections = sqliteTable(
  'group_nav_sections',
  {
    // `{groupId}-{sectionId}` is the primary key
    id: text('id').primaryKey(),
    // this separate ID is necessary for the groupNavSectionChannels table
    // because every group has a `default` section/zone, so we can't use that as
    // the primary key, but we still need to use the sectionId when communicating
    // with the backend
    sectionId: text('section_id').notNull(),
    groupId: text('group_id').references(() => groups.id, {
      onDelete: 'cascade',
    }),
    ...metaFields,
    // a column cannot be named "index" because it's a reserved word in SQLite
    sectionIndex: integer('section_index'),
  },
  (table) => {
    return {
      groupIdIndex: index('group_nav_sections_group_id_index').on(
        table.groupId
      ),
    };
  }
);

export const groupNavSectionRelations = relations(
  groupNavSections,
  ({ one, many }) => ({
    channels: many(groupNavSectionChannels),
    group: one(groups, {
      fields: [groupNavSections.groupId],
      references: [groups.id],
    }),
  })
);

export const groupNavSectionChannels = sqliteTable(
  'group_nav_section_channels',
  {
    groupNavSectionId: text('group_nav_section_id').references(
      () => groupNavSections.id,
      {
        onDelete: 'cascade',
      }
    ),
    channelId: text('channel_id').references(() => channels.id, {
      onDelete: 'cascade',
    }),
    channelIndex: integer('channel_index'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupNavSectionId, table.channelId] }),
    groupNavSectionIdIndex: index(
      'group_nav_section_channels_group_nav_section_id_index'
    ).on(table.groupNavSectionId),
    channelIdIndex: index('group_nav_section_channels_channel_id_index').on(
      table.channelId
    ),
  })
);

export const groupNavSectionChannelsRelations = relations(
  groupNavSectionChannels,
  ({ one }) => ({
    groupNavSection: one(groupNavSections, {
      fields: [groupNavSectionChannels.groupNavSectionId],
      references: [groupNavSections.id],
    }),
    channel: one(channels, {
      fields: [groupNavSectionChannels.channelId],
      references: [channels.id],
    }),
  })
);

export const volumeSettings = sqliteTable(
  'volume_settings',
  {
    itemId: text('item_id').primaryKey(),
    itemType: text('item_type')
      .$type<'group' | 'channel' | 'thread' | 'base'>()
      .notNull(),
    level: text('level').$type<NotificationLevel>().notNull(),
  },
  (table) => {
    return {
      itemIdIndex: index('volume_settings_item_id_index').on(table.itemId),
    };
  }
);

export type ChannelType = 'chat' | 'notebook' | 'gallery' | 'dm' | 'groupDm';

export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    type: text('type').$type<ChannelType>().notNull(),
    groupId: text('group_id').references(() => groups.id, {
      onDelete: 'cascade',
    }),
    ...metaFields,
    contactId: text('contact_id'),
    addedToGroupAt: timestamp('added_to_group_at'),
    currentUserIsMember: boolean('current_user_is_member'),
    currentUserIsHost: boolean('current_user_is_host'),
    postCount: integer('post_count'),
    unreadCount: integer('unread_count'),
    firstUnreadPostId: text('first_unread_post_id'),
    lastPostId: text('last_post_id'),
    lastPostAt: timestamp('last_post_at'),
    lastPostSequenceNum: integer('last_post_sequence_num'),
    isPendingChannel: boolean('is_cached_pending_channel'),
    isNewMatchedContact: boolean('is_new_matched_contact'),
    isDmInvite: boolean('is_dm_invite').default(false),

    /**
     * Last time we ran a sync, in local time
     */
    syncedAt: timestamp('synced_at'),
    /**
     * Remote time that this channel was last updated.
     * From `recency` on unreads on the Urbit side
     */
    remoteUpdatedAt: timestamp('remote_updated_at'),

    /**
     * Local time that this channel was last viewed by this client;
     * null if never viewed (or after a database reset)
     */
    lastViewedAt: timestamp('last_viewed_at'),

    contentConfiguration: text('content_configuration', {
      mode: 'json',
    }).$type<ChannelContentConfiguration>(),

    order: text('posts_order', {
      mode: 'json',
    }).$type<string[]>(),
  },
  (table) => ({
    lastPostIdIndex: index('last_post_id').on(table.lastPostId),
    lastPostAtIndex: index('last_post_at').on(table.lastPostAt),
    groupIdIndex: index('channels_group_id_index').on(table.groupId),
    contactIdIndex: index('channels_contact_id_index').on(table.contactId),
  })
);

export const channelRelations = relations(channels, ({ one, many }) => ({
  pin: one(pins),
  group: one(groups, {
    fields: [channels.groupId],
    references: [groups.id],
  }),
  contact: one(contacts, {
    fields: [channels.contactId],
    references: [contacts.id],
  }),
  posts: many(posts),
  lastPost: one(posts, {
    fields: [channels.lastPostId],
    references: [posts.id],
  }),
  unread: one(channelUnreads, {
    fields: [channels.id],
    references: [channelUnreads.channelId],
  }),
  threadUnreads: many(threadUnreads),
  members: many(chatMembers),
  writerRoles: many(channelWriters),
  readerRoles: many(channelReaders),
  volumeSettings: one(volumeSettings, {
    fields: [channels.id],
    references: [volumeSettings.itemId],
  }),
}));

export type PostDeliveryStatus =
  | 'enqueued'
  | 'pending'
  | 'sent'
  | 'failed'
  | 'needs_verification';

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey().notNull(),
    authorId: text('author_id').notNull(),
    channelId: text('channel_id').notNull(),
    groupId: text('group_id'),
    parentId: text('parent_id'),
    type: text('type')
      .$type<'block' | 'chat' | 'notice' | 'note' | 'reply' | 'delete'>()
      .notNull(),
    title: text('title'),
    image: text('image'),
    description: text('description'),
    cover: text('cover'),
    content: text('content', { mode: 'json' }),
    receivedAt: timestamp('received_at').notNull(),
    sentAt: timestamp('sent_at').notNull(),
    // client-side time
    replyCount: integer('reply_count'),
    replyTime: timestamp('reply_time'),
    replyContactIds: text('reply_contact_ids', {
      mode: 'json',
    }).$type<string[]>(),
    textContent: text('text_content'),
    hasAppReference: boolean('has_app_reference'),
    hasChannelReference: boolean('has_channel_reference'),
    hasGroupReference: boolean('has_group_reference'),
    hasLink: boolean('has_link'),
    hasImage: boolean('has_image'),
    hidden: boolean('hidden').default(false),
    isEdited: boolean('is_edited'),
    isDeleted: boolean('is_deleted'),
    isSequenceStub: boolean('is_sequence_stub').default(false),
    deletedAt: timestamp('deleted_at'),
    deliveryStatus: text('delivery_status').$type<PostDeliveryStatus>(),
    editStatus: text('edit_status').$type<PostDeliveryStatus>(),
    deleteStatus: text('delete_status').$type<PostDeliveryStatus>(),
    lastEditContent: text('last_edit_content', { mode: 'json' }),
    lastEditTitle: text('last_edit_title'),
    lastEditImage: text('last_edit_image'),
    sequenceNum: integer('sequence_number'),
    /**
     * If `syncedAt` is null, it indicates that the post is unconfirmed by sync.
     */
    syncedAt: timestamp('synced_at'),
    // backendTime translates to an unfortunate alternative timestamp that is used
    // in some places by the backend agents as part of a composite key for identifying a post.
    // You should not be accessing this field except in very particular contexts.
    backendTime: text('backend_time'),
    /** freeform data associated with this post */
    blob: text('blob'),
  },
  (table) => ({
    cacheId: uniqueIndex('cache_id').on(
      table.channelId,
      table.authorId,
      table.sentAt,
      table.sequenceNum
    ),
    channelId: index('posts_channel_id').on(table.channelId, table.id),
    groupId: index('posts_group_id').on(table.groupId, table.id),
    authorIdIndex: index('posts_author_id_index').on(table.authorId),
    parentIdIndex: index('posts_parent_id_index').on(table.parentId),
  })
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  channel: one(channels, {
    fields: [posts.channelId],
    references: [channels.id],
  }),
  group: one(groups, {
    fields: [posts.groupId],
    references: [groups.id],
  }),
  reactions: many(postReactions),
  author: one(contacts, {
    fields: [posts.authorId],
    references: [contacts.id],
  }),
  parent: one(posts, {
    fields: [posts.parentId],
    references: [posts.id],
    relationName: 'parent',
  }),
  threadUnread: one(threadUnreads, {
    fields: [posts.id],
    references: [threadUnreads.threadId],
  }),
  replies: many(posts, { relationName: 'parent' }),
  images: many(postImages),
  volumeSettings: one(volumeSettings, {
    fields: [posts.id],
    references: [volumeSettings.itemId],
  }),
}));

export const postImages = sqliteTable(
  'post_images',
  {
    postId: text('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    src: text('src'),
    alt: text('alt'),
    width: integer('width'),
    height: integer('height'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.src] }),
    postIdIndex: index('post_images_post_id_index').on(table.postId),
  })
);

export const postImageRelations = relations(postImages, ({ one }) => ({
  post: one(posts, {
    fields: [postImages.postId],
    references: [posts.id],
  }),
}));

export const postReactions = sqliteTable(
  'post_reactions',
  {
    contactId: text('contact_id').notNull(),
    postId: text('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    value: text('value').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.contactId, table.postId] }),
      contactIdIndex: index('post_reactions_contact_id_index').on(
        table.contactId
      ),
      postIdIndex: index('post_reactions_post_id_index').on(table.postId),
    };
  }
);

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(posts, {
    fields: [postReactions.postId],
    references: [posts.id],
  }),
  contact: one(contacts, {
    fields: [postReactions.contactId],
    references: [contacts.id],
  }),
}));
