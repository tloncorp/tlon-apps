import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { GroupMeta } from "../urbit/groups";
import {
  Cabals,
  Channels,
  Cordon,
  FlaggedContent,
  Fleet,
  Saga,
  Zone,
  Zones,
} from "../urbit/groups";

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  nickname: text("nickname"),
  bio: text("bio"),
  status: text("status"),
  color: text("color"),
  avatarImage: text("avatarImage"),
  coverImage: text("coverImage"),
  pinnedGroupIds: text("pinnedGroupIds"),
});

export type Contact = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;

export const unreads = sqliteTable("unreads", {
  channelId: text("channelId"),
  type: text("type"),
  totalCount: integer("totalCount"),
});

export type Unread = typeof unreads.$inferSelect;
export type UnreadInsert = typeof unreads.$inferInsert;

export const groups = sqliteTable("groups", {
  flag: text("flag").primaryKey(),
  fleet: text("fleet", { mode: "json" }).$type<Fleet>(),
  cabals: text("cabals", { mode: "json" }).$type<Cabals>(),
  channels: text("channels", { mode: "json" }).$type<Channels>(),
  cordon: text("cordon", { mode: "json" }).$type<Cordon>(),
  meta: text("meta", { mode: "json" }).$type<GroupMeta>(),
  zones: text("zones", { mode: "json" }).$type<Zones>(),
  zoneOrder: text("zoneOrder", { mode: "json" }).$type<Zone[]>(),
  bloc: text("bloc", { mode: "json" }).$type<string[]>(),
  secret: integer("secret", { mode: "boolean" }),
  saga: text("saga", { mode: "json" }).$type<Saga | null>(),
  flaggedContent: text("flaggedContent", {
    mode: "json",
  }).$type<FlaggedContent>(),
});

export type Group = typeof groups.$inferSelect;
export type GroupInsert = typeof groups.$inferInsert;
