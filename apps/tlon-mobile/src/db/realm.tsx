import { createRealmContext } from '@realm/react';
import React from 'react';
import type { PropsWithChildren } from 'react';
import type Realm from 'realm';

import type { SchemaMap, SchemaName } from './schemas';
import { schemas } from './schemas';

// This is a copy of Realm's `UpdateMode` enum. Not ideal, but realm only
// exports `UpdateMode` as a type, which causes a lint error if we try to use it
// directly.
export enum UpdateMode {
  Never = 'never',
  Modified = 'modified',
  All = 'all',
}

// Realm provider setup

const config: Realm.Configuration = {
  schema: schemas,
  schemaVersion: 0,
};

const {
  RealmProvider: BaseRealmProvider,
  useObject,
  useQuery,
  useRealm,
} = createRealmContext(config);

let realmInstance: Realm | null = null;

function realm() {
  if (!realmInstance) {
    throw new Error('Realm instance not available');
  }
  return realmInstance;
}

// The only straightforward way to get the realm instance here is to use the
// `realmRef` property. Since the property takes a ref, we use a proxy to
// synchronously mirror the set value to the local `realm` variable.
const realmRefProxy = {
  set current(val: Realm | null) {
    realmInstance = val;
  },
};

const RealmProvider = ({ children }: PropsWithChildren) => {
  return (
    <BaseRealmProvider realmRef={realmRefProxy}>{children}</BaseRealmProvider>
  );
};

export { RealmProvider, useObject, useQuery, useRealm };

// Utility functions

export function createBatch<T extends SchemaName>(
  model: T,
  data: SchemaMap[T][],
  updateMode = UpdateMode.Modified
): SchemaMap[T][] {
  return realm().write(() =>
    data.map((d) => {
      return realm().create<SchemaMap[T]>(model, d, updateMode);
    })
  );
}

export function create<T extends SchemaName>(
  model: T,
  data: SchemaMap[T],
  updateMode = UpdateMode.Modified
): SchemaMap[T] {
  return realm().write(() =>
    realm().create<SchemaMap[T]>(model, data, updateMode)
  );
}

export function update<T extends SchemaName>(
  model: T,
  data: Partial<SchemaMap[T]>,
  updateMode = UpdateMode.Modified
): SchemaMap[T] {
  return realm().write(() =>
    realm().create<SchemaMap[T]>(model, data, updateMode)
  );
}
