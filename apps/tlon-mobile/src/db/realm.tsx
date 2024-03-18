import { createRealmContext } from '@realm/react';
import React from 'react';
import type { PropsWithChildren } from 'react';
import type Realm from 'realm';

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
  schemaVersion: 9,
  deleteRealmIfMigrationNeeded: process.env.NODE_ENV === 'DEVELOPMENT',
};

const {
  RealmProvider: BaseRealmProvider,
  useObject,
  useQuery,
  useRealm,
} = createRealmContext(config);

let realmInstance: Realm | null = null;

export const realm = new Proxy(
  {},
  {
    get(_, prop) {
      if (!realmInstance) throw new Error('Realm not initialized');
      return realmInstance[prop as keyof Realm];
    },
  }
) as Realm;

// The only straightforward way to get the realm instance here is to use the
// `realmRef` property. Since the property takes a ref, we use a proxy to
// synchronously mirror the set value to the local `realm` variable.
const realmRefProxy = {
  set current(val: Realm | null) {
    console.log('Realm initialized at ' + val?.path);
    realmInstance = val;
  },
};

const RealmProvider = ({ children }: PropsWithChildren) => {
  return (
    <BaseRealmProvider realmRef={realmRefProxy}>{children}</BaseRealmProvider>
  );
};

export { RealmProvider, useObject, useQuery, useRealm };
