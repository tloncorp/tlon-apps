// This file contains functions which interact with the database. The idea is
// that anything that needs to reference Realm or its types happens here, rather
// than in app code. None of the arguments these functions take should be unique
// to Realm. That way, we've got an interface that can be swapped out eg. for web.
import Realm, {UpdateMode} from 'realm';
import type {SchemaMap} from './models';
import * as models from './models';
import {QueryFn} from './types';
import {createCachingCollectionProxy} from './utils';
import type {PrimarySchemaName, SchemaModel, SchemaValue} from './types';
import {Results} from './types';
import {asReadOnlyArray} from './utils';

export function create<T extends PrimarySchemaName>(
  realm: Realm,
  model: T,
  data: SchemaMap[T],
  updateMode = Realm.UpdateMode.Modified,
): SchemaMap[T] {
  return batch(realm, () =>
    realm.create<SchemaMap[T]>(model, data, updateMode),
  );
}

export function update<T extends PrimarySchemaName>(
  realm: Realm,
  model: T,
  data: Partial<SchemaMap[T]>,
  updateMode = Realm.UpdateMode.Modified,
): SchemaMap[T] {
  return batch(realm, () =>
    realm.create<SchemaMap[T]>(model, data, updateMode),
  );
}

export function getObject<T extends PrimarySchemaName>(
  realm: Realm,
  model: T,
  id: SchemaValue<T>,
): SchemaMap[T] | null {
  return realm.objectForPrimaryKey<SchemaMap[T]>(model, id);
}

/**
 * Gets objects.
 */
export function getObjects<T extends PrimarySchemaName>(
  realm: Realm,
  schemaName: T,
  query?: QueryFn<T>,
): ReadonlyArray<SchemaModel<T>> {
  const results = realm.objects(schemaName) as unknown as Results<T>;
  const queryResults = query ? query(results) : results;
  const snapshot = queryResults.snapshot();
  const cachedQuery = createCachingCollectionProxy(snapshot);
  return asReadOnlyArray(cachedQuery);
}

/**
 * Executes a function inside a realm write block. Unlike realm.write, this can
 * be nested without causing issues.
 */
export function batch<T>(realm: Realm, cb: () => T) {
  if (realm.isInTransaction) {
    return cb();
  } else {
    return realm.write(cb);
  }
}

// Post

/**
 * Stores a list of posts from a single channel. Slightly more efficient than
 * doing the normal channel/group lookup in `createPost`
 */
export function createChannelPosts(
  realm: Realm,
  posts: models.Post[],
  channel: models.Channel,
) {
  batch(realm, () => {
    let lastPost: models.Post | null = null;
    for (let post of posts) {
      lastPost = create(
        realm,
        'Post',
        {...post, group: channel.group},
        UpdateMode.All,
      );
    }
    if (lastPost) {
      if (
        !channel.latestPost ||
        lastPost.receivedAt > channel.latestPost.receivedAt
      ) {
        channel.latestPost = lastPost;
      }
      if (
        channel.group &&
        (!channel.group.latestPost ||
          lastPost.receivedAt > channel.group.latestPost.receivedAt)
      ) {
        channel.group.latestPost = lastPost;
      }
    }
  });
}

// Group

export function createGroups(realm: Realm, groups: models.Group[]) {
  return batch(realm, () => {
    for (let {channels, ...group} of groups) {
      const createdGroup = create(realm, 'Group', group, UpdateMode.Modified);
      if (channels) {
        for (let channel of channels) {
          create(
            realm,
            'Channel',
            {...channel, group: createdGroup},
            UpdateMode.Modified,
          );
        }
      }
    }
  });
}

// Account

export function createOrUpdateAccount(realm: Realm, data: models.Account) {
  batch(realm, () => {
    create(realm, 'Account', data, UpdateMode.Modified);
  });
}

// Tabs

export function createOrUpdateTab(
  realm: Realm,
  {
    groupId,
    settingsIndex,
    settings,
  }: {
    groupId: string;
    settingsIndex: number | null;
    settings: models.TabSettings;
  },
) {
  const tabGroup = getObject(realm, 'TabGroupSettings', groupId);
  batch(realm, () => {
    if (tabGroup) {
      const targetIndex = settingsIndex ?? tabGroup.tabs.length;
      tabGroup.tabs.splice(targetIndex, 1, settings);
    } else {
      create(realm, 'TabGroupSettings', {
        id: groupId,
        tabs: [settings],
      });
    }
  });
}

export function deleteTab(
  realm: Realm,
  {groupId, settingsIndex}: {groupId: string; settingsIndex: number},
) {
  const tabGroup = getObject(realm, 'TabGroupSettings', groupId);
  if (tabGroup) {
    batch(realm, () => {
      tabGroup.tabs.splice(settingsIndex, 1);
    });
  }
}
