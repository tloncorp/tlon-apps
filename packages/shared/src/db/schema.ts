import { relations } from "drizzle-orm";
import {
  integer,
  primaryKey,
  foreignKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const boolean = (name: string) => {
  return integer(name, { mode: "boolean" });
};

const timestamp = (name: string) => {
  return integer(name);
};

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  nickname: text("nickname"),
  bio: text("bio"),
  status: text("status"),
  color: text("color"),
  avatarImage: text("avatarImage"),
  coverImage: text("coverImage"),
});

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  pinnedGroups: many(contactGroups),
}));

export const contactGroups = sqliteTable(
  "contact_group_pins",
  {
    contactId: text("contact_id")
      .references(() => contacts.id)
      .notNull(),
    groupId: text("group_id")
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

export const unreads = sqliteTable("unreads", {
  channelId: text("channelId")
    .primaryKey()
    .references(() => channels.id),
  type: text("type").$type<"channel" | "dm">(),
  totalCount: integer("totalCount"),
});

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  iconImage: text("icon_image"),
  iconImageColor: text("icon_image_color"),
  coverImage: text("cover_image"),
  coverImageColor: text("cover_image_color"),
  title: text("title"),
  description: text("description"),
  isSecret: boolean("is_secret"),
  lastPostAt: timestamp("last_post_at"),
});

export const pins = sqliteTable("pins", {
  type: text("type").$type<"group" | "dm" | "club">(),
  itemId: text("item_id"),
});

export const groupsRelations = relations(groups, ({ one, many }) => ({
  roles: many(groupRoles),
  members: many(groupMembers),
  navSections: many(groupNavSections),
  channels: many(channels),
  posts: many(posts),
}));

export const groupRoles = sqliteTable(
  "group_roles",
  {
    id: text("id"),
    groupId: text("group_id").references(() => groups.id),
    iconImage: text("image"),
    title: text("title"),
    coverImage: text("cover"),
    description: text("description"),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.groupId, table.id] }),
    };
  }
);

export const groupRolesRelations = relations(groupRoles, ({ one, many }) => ({
  members: many(groupMembers),
  group: one(groups, {
    fields: [groupRoles.groupId],
    references: [groups.id],
  }),
}));

export const groupMembers = sqliteTable(
  "group_members",
  {
    groupId: text("group_id")
      .references(() => groups.id)
      .notNull(),
    contactId: text("contact_id")
      .references(() => contacts.id)
      .notNull(),
    joinedAt: timestamp("joined_at"),
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
  "group_member_roles",
  {
    groupId: text("group_id")
      .references(() => groups.id)
      .notNull(),
    contactId: text("contact_id")
      .references(() => contacts.id)
      .notNull(),
    roleId: text("role_id").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.groupId, table.contactId, table.roleId],
      }),
      role: foreignKey({
        columns: [table.groupId, table.roleId],
        foreignColumns: [groupRoles.groupId, groupRoles.id],
      }),
    };
  }
);

export const groupMemberRolesRelations = relations(
  groupMemberRoles,
  ({ one }) => ({
    role: one(groupRoles, {
      fields: [groupMemberRoles.groupId, groupMemberRoles.roleId],
      references: [groupRoles.groupId, groupRoles.id],
    }),
  })
);

export const groupNavSections = sqliteTable("group_nav_sections", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => groups.id),
  iconImage: text("icon_image"),
  coverImage: text("cover_image"),
  title: text("title"),
  description: text("description"),
  index: integer("index"),
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
  "group_nav_section_channels",
  {
    groupNavSectionId: integer("group_nav_section_id").references(
      () => groupNavSections.id
    ),
    channelId: integer("channel_id").references(() => channels.id),
    index: integer("index"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupNavSectionId, table.channelId] }),
  })
);

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  groupId: text("group_id").references(() => groups.id),
  iconImage: text("icon_image"),
  coverImage: text("cover_image"),
  title: text("title"),
  description: text("description"),
  addedToGroupAt: timestamp("added_to_group_at"),
  currentUserIsMember: boolean("current_user_is_member"),
  postCount: integer("post_count"),
  unreadCount: integer("unread_count"),
  firstUnreadPostId: text("first_unread_post_id"),
  lastPostAt: timestamp("last_post_at"),
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
  "thread_unread_states",
  {
    channelId: integer("channel_id").references(() => channels.id),
    threadId: text("thread_id"),
    count: integer("count"),
    firstUnreadPostId: text("first_unread_post_id"),
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

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  authorId: integer("author_id").references(() => contacts.id),
  title: text("title"),
  image: text("image"),
  content: text("content"),
  sentAt: timestamp("sent_at"),
  receivedAt: timestamp("received_at"),
  replyCount: integer("reply_count"),
  type: text("type"),
  channelId: integer("channel_id").references(() => channels.id),
  groupId: text("group_id").references(() => groups.id),
  text: text("text"),
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
  reactions: many(reactions),
  author: one(contacts, {
    fields: [posts.authorId],
    references: [contacts.id],
  }),
}));

export const reactions = sqliteTable(
  "reactions",
  {
    contactId: text("contact_id")
      .references(() => contacts.id)
      .notNull(),
    postId: text("post_id")
      .references(() => posts.id)
      .notNull(),
    value: text("value").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.contactId, table.postId] }),
    };
  }
);

export const reactionsRelations = relations(reactions, ({ one }) => ({
  post: one(posts, {
    fields: [reactions.postId],
    references: [posts.id],
  }),
  contact: one(contacts, {
    fields: [reactions.contactId],
    references: [contacts.id],
  }),
}));
