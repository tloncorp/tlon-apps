import { beforeAll, beforeEach, expect, test } from "vitest";
import { toClientGroups } from "../api/groupsApi";
import { resetDb, setupDb } from "../test/helpers";
import type * as ub from "../urbit/groups";
import groupsResponse from "../test/groups.json";
import * as queries from "./queries";

const groupsData = toClientGroups(
  groupsResponse as unknown as Record<string, ub.Group>
);

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

test("inserts a group", async () => {
  const groupData = groupsData[3];
  await queries.insertGroup(groupData);
  const roles = await queries.getGroupRoles(groupData.id);
  expect(roles.length).toEqual(groupData.roles?.length);
  const result = await queries.getGroup(groupData.id);
  expect(result?.id).toBe(groupData.id);
});

test("inserts all groups", async () => {
  await queries.insertGroups(groupsData);
  const groups = await queries.getGroups();
  expect(groups.length).toEqual(groupsData.length);
});
