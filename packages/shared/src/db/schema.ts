import { relations } from 'drizzle-orm';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

const boolean = (name: string) => {
  return integer(name, { mode: 'boolean' });
};

const timestamp = (name: string) => {
  return integer(name);
};

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  nickname: text('nickname'),
  bio: text('bio'),
  status: text('status'),
  color: text('color'),
  avatarImage: text('avatarImage'),
  coverImage: text('coverImage'),
});

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  pinnedGroups: many(contactGroups),
}));

export const contactGroups = sqliteTable(
  'contact_group_pins',
  {
    contactId: text('contact_id')
      .references(() => contacts.id)
      .notNull(),
    groupId: text('group_id')
      .references(() => groups.id)
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.contactId, table.groupId] }),
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

export const unreads = sqliteTable('unreads', {
  channelId: text('channelId')
    .primaryKey()
    .references(() => channels.id),
  type: text('type').$type<'channel' | 'dm'>(),
  totalCount: integer('totalCount'),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const pins = sqliteTable(
  'pins',
  {
    type: text('type').$type<'group' | 'dm' | 'club'>().notNull(),
    index: integer('index').notNull(),
    itemId: text('item_id').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.itemId] }),
    };
  }
);

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  iconImage: text('icon_image'),
  iconImageColor: text('icon_image_color'),
  coverImage: text('cover_image'),
  coverImageColor: text('cover_image_color'),
  title: text('title'),
  description: text('description'),
  isSecret: boolean('is_secret'),
  isJoined: boolean('is_joined'),
  lastPostId: text('last_post_id'),
  lastPostAt: timestamp('last_post_at'),
  pinIndex: integer('pin_index'),
});

export const groupsRelations = relations(groups, ({ one, many }) => ({
  roles: many(groupRoles),
  members: many(groupMembers),
  navSections: many(groupNavSections),
  channels: many(channels),
  posts: many(posts),
  lastPost: one(posts, {
    fields: [groups.lastPostId],
    references: [posts.id],
  }),
}));

export const groupRoles = sqliteTable(
  'group_roles',
  {
    id: text('id'),
    groupId: text('group_id').references(() => groups.id),
    iconImage: text('image'),
    title: text('title'),
    coverImage: text('cover'),
    description: text('description'),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.groupId, table.id] }),
    };
  }
);

export const groupRolesRelations = relations(groupRoles, ({ one, many }) => ({
  members: many(groupMemberRoles),
  group: one(groups, {
    fields: [groupRoles.groupId],
    references: [groups.id],
  }),
}));

export const groupMembers = sqliteTable(
  'group_members',
  {
    groupId: text('group_id')
      .references(() => groups.id)
      .notNull(),
    contactId: text('contact_id')
      .references(() => contacts.id)
      .notNull(),
    joinedAt: timestamp('joined_at'),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.groupId, table.contactId] }),
    };
  }
);

export const groupMembersRelations = relations(
  groupMembers,
  ({ one, many }) => ({
    roles: many(groupMemberRoles),
    group: one(groups, {
      fields: [groupMembers.groupId],
      references: [groups.id],
    }),
    contact: one(contacts, {
      fields: [groupMembers.contactId],
      references: [contacts.id],
    }),
  })
);

export const groupMemberRoles = sqliteTable(
  'group_member_roles',
  {
    groupId: text('group_id')
      .references(() => groups.id)
      .notNull(),
    contactId: text('contact_id')
      .references(() => contacts.id)
      .notNull(),
    roleId: text('role_id').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.contactId, table.roleId],
      }),
    };
  }
);

export const groupMemberRolesRelations = relations(
  groupMemberRoles,
  ({ one }) => ({
    groupMember: one(groupMembers, {
      fields: [groupMemberRoles.groupId, groupMemberRoles.contactId],
      references: [groupMembers.groupId, groupMembers.contactId],
    }),
    groupRole: one(groupRoles, {
      fields: [groupMemberRoles.groupId, groupMemberRoles.roleId],
      references: [groupRoles.groupId, groupRoles.id],
    }),
  })
);

export const groupNavSections = sqliteTable('group_nav_sections', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => groups.id),
  iconImage: text('icon_image'),
  coverImage: text('cover_image'),
  title: text('title'),
  description: text('description'),
  index: integer('index'),
});

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
      () => groupNavSections.id
    ),
    channelId: text('channel_id').references(() => channels.id),
    index: integer('index'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupNavSectionId, table.channelId] }),
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

export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  type: text('type').$type<'chat' | 'notebook' | 'gallery'>().notNull(),
  groupId: text('group_id').references(() => groups.id),
  iconImage: text('icon_image'),
  coverImage: text('cover_image'),
  title: text('title'),
  description: text('description'),
  addedToGroupAt: timestamp('added_to_group_at'),
  currentUserIsMember: boolean('current_user_is_member'),
  postCount: integer('post_count'),
  unreadCount: integer('unread_count'),
  firstUnreadPostId: text('first_unread_post_id'),
  lastPostId: text('last_post_id'),
  lastPostAt: timestamp('last_post_at'),
  /**
   * Last time we ran a sync, in local time
   */
  syncedAt: timestamp('synced_at'),
  /**
   * Remote time that this channel was last updated.
   * From `recency` on unreads on the Urbit side
   */
  remoteUpdatedAt: timestamp('remote_updated_at'),
});

export const channelRelations = relations(channels, ({ one, many }) => ({
  group: one(groups, {
    fields: [channels.groupId],
    references: [groups.id],
  }),
  posts: many(posts),
  threadUnreadStates: many(threadUnreadStates),
}));

export const threadUnreadStates = sqliteTable(
  'thread_unread_states',
  {
    channelId: integer('channel_id').references(() => channels.id),
    threadId: text('thread_id'),
    count: integer('count'),
    firstUnreadPostId: text('first_unread_post_id'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.channelId, table.threadId],
    }),
  })
);

export const threadUnreadStateRelations = relations(
  threadUnreadStates,
  ({ one }) => ({
    channel: one(channels, {
      fields: [threadUnreadStates.channelId],
      references: [channels.id],
    }),
  })
);

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey().notNull(),
  authorId: text('author_id').notNull(),
  channelId: text('channel_id').notNull(),
  groupId: text('group_id'),
  type: text('type').$type<'block' | 'chat' | 'notice' | 'note'>().notNull(),
  title: text('title'),
  image: text('image'),
  content: text('content', { mode: 'json' }),
  receivedAt: timestamp('received_at').notNull(),
  sentAt: timestamp('sent_at').notNull(),
  // client-side time
  replyCount: integer('reply_count'),
  textContent: text('text_content'),
  hasAppReference: boolean('has_app_reference'),
  hasChannelReference: boolean('has_channel_reference'),
  hasGroupReference: boolean('has_group_reference'),
  hasLink: boolean('has_link'),
  hasImage: boolean('has_image'),
});

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
  images: many(postImages),
}));

export const postImages = sqliteTable(
  'post_images',
  {
    postId: text('post_id').references(() => posts.id),
    src: text('src'),
    alt: text('alt'),
    width: integer('width'),
    height: integer('height'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.src] }),
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
    contactId: text('contact_id')
      .references(() => contacts.id)
      .notNull(),
    postId: text('post_id')
      .references(() => posts.id)
      .notNull(),
    value: text('value').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.contactId, table.postId] }),
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
