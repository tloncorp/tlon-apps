import {createRealmContext} from '@realm/react';
import Realm from 'realm';
import {schemas} from './models';

const config: Realm.Configuration = {
  schema: schemas,
  schemaVersion: 11,
  deleteRealmIfMigrationNeeded: process.env.NODE_ENV !== 'development',
};

export const {RealmProvider, useObject, useQuery, useRealm} =
  createRealmContext(config);
