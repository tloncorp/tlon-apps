import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import tmp from "tmp";
import { beforeEach, expect, test } from "vitest";
import { toClientGroup, toClientGroups } from "../api/groupsApi";
import type * as ub from "../urbit/groups";
import { setDb } from "./";
import groupsResponse from "./groups.json";
import * as queries from "./queries";
import * as schema from "./schemas";

const groupsData = toClientGroups(
  groupsResponse as unknown as Record<string, ub.Group>
);

let dbFile: tmp.FileResult | null = null;

beforeEach(() => {
  if (dbFile) dbFile.removeCallback();
  dbFile = tmp.fileSync();
  const sqlite = new Database(dbFile.name);
  const db = drizzle(sqlite, { schema, logger: true });
  migrate(db, {
    migrationsFolder: "../../apps/tlon-web/src/drizzle",
  });
  setDb(db);
});

test("inserts a group", async () => {
  const groupData = groupsData[3];
  await queries.insertGroup(groupData);
  const roles = await queries.getGroupRoles(groupData.id);
  expect(roles.length).toEqual(groupData.roles.length);
  const result = await queries.getGroup(groupData.id);
  expect(result.id).toBe(groupData.id);
});

test("inserts all groups", async () => {
  await queries.insertGroups(groupsData);
  const groups = await queries.getGroups();
  expect(groups.length).toEqual(groupsData.length);
});
