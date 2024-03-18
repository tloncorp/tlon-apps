import type { UnreadType } from '@tloncorp/shared';

import { UpdateMode, realm } from './realm';
import type {
  SchemaMap,
  SchemaModel,
  SchemaName,
  SchemaValue,
} from './schemas';

// Model queries

export function unreadChannelsQuery(type: UnreadType): QueryFn<'Unread'> {
  return (collection: Results<'Unread'>) => {
    return collection.filtered('type == $0 AND totalCount > 0', type);
  };
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
