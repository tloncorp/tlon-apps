import type { ClientTypes as Client } from '@tloncorp/shared';

import { UpdateMode, realm } from './realm';
import type {
  SchemaMap,
  SchemaModel,
  SchemaName,
  SchemaValue,
} from './schemas';

// Model queries

export function unreadChannelsQuery(
  type: Client.UnreadType
): QueryFn<'Unread'> {
  return (collection: Results<'Unread'>) => {
    return collection.filtered('type == $0 AND totalCount > 0', type);
  };
}

export interface GroupQuerySettings {
  isPinned?: boolean;
  sortBy?: 'pinIndex' | 'lastPostAt';
  sortDirection?: 'asc' | 'desc';
}

export const groupQuery =
  (settings: GroupQuerySettings): QueryFn<'Group'> =>
  (query: Results<'Group'>) => {
    if ('isPinned' in settings) {
      query = query.filtered(
        `pinIndex ${settings.isPinned ? '!=' : '=='} NULL`
      );
    }
    if (settings.sortBy) {
      query = query.sorted(
        settings.sortBy,
        settings.sortDirection === 'asc' ? false : true
      );
    }
    return query;
  };

export const getUnreadChannelCount = (group: Client.Group) => {
  return getObjects('Channel', (q) => {
    return q.filtered('group == $0 && unreadCount > 0', group);
  }).length;
};

export function updatePinnedGroups(pinnedGroups: string[]) {
  return batch(() => {
    // Clear previous pin indexes
    const lastPinnedGroups = getObjects(
      'Group',
      groupQuery({ isPinned: true })
    );
    lastPinnedGroups.forEach((g) => (g.pinIndex = null));
    // Set new pin indexes
    pinnedGroups.forEach((groupId, i) => {
      const group = getObject('Group', groupId);
      if (group) {
        group.pinIndex = i;
      }
    });
  });
}

export function updateChannelUnreadStates(channels: Client.Unread[]) {
  return batch(() => {
    channels.forEach((c) => {
      const channel = create(
        'Channel',
        { id: c.channelId, unreadCount: c.totalCount },
        UpdateMode.Modified
      );
      if (
        channel.group &&
        (channel.lastPostAt ?? 0) > (channel.group.lastPostAt ?? 0)
      ) {
        channel.group.lastPostAt = channel.lastPostAt;
      }
    });
  });
}

// Generic queries

export function createBatch<T extends SchemaName>(
  model: T,
  data: SchemaMap[T][],
  updateMode = UpdateMode.Modified
): SchemaMap[T][] {
  return batch(() =>
    data.map((d) => {
      return realm.create<SchemaMap[T]>(model, d, updateMode);
    })
  );
}

export function create<T extends SchemaName>(
  model: T,
  data: SchemaMap[T],
  updateMode = UpdateMode.Modified
): SchemaMap[T] {
  return batch(() => realm.create<SchemaMap[T]>(model, data, updateMode));
}

export function update<T extends SchemaName>(
  model: T,
  data: Partial<SchemaMap[T]>,
  updateMode = UpdateMode.Modified
): SchemaMap[T] {
  return batch(() => realm.create<SchemaMap[T]>(model, data, updateMode));
}

export function getObject<T extends SchemaName>(
  model: T,
  id: SchemaValue<T>
): SchemaMap[T] | null {
  return realm.objectForPrimaryKey<SchemaMap[T]>(model, id);
}

export type Results<
  T extends SchemaName,
  IsRealm extends boolean = false,
> = Realm.Results<
  IsRealm extends true ? Realm.Object<SchemaModel<T>> : SchemaModel<T>
>;

export type QueryFn<T extends SchemaName, IsRealm extends boolean = false> = (
  collection: Results<T, IsRealm>
) => Results<T, IsRealm>;

export function getObjects<T extends SchemaName>(
  schemaName: T,
  query?: QueryFn<T>
) {
  const results = realm.objects(schemaName) as unknown as Results<T>;
  return query ? query(results) : results;
}

/**
 * Executes a function inside a realm write block. Unlike realm.write, this can
 * be nested without causing issues.
 */
export function batch<T>(cb: () => T) {
  if (realm.isInTransaction) {
    return cb();
  } else {
    return realm.write(cb);
  }
}
