import Realm from 'realm';
import {PrimarySchemaMap, SchemaMap} from './models';

export type PrimarySchemaName = keyof PrimarySchemaMap;
export type SchemaName = keyof SchemaMap;
export type SchemaModel<T extends SchemaName> = SchemaMap[T];
export type SchemaKey<T extends SchemaName> = keyof SchemaModel<T>;
export type SchemaValue<T extends SchemaName> = SchemaModel<T>[SchemaKey<T>];
export type AnyPrimaryModel = SchemaModel<keyof PrimarySchemaMap>;
export type AnyModel = SchemaModel<SchemaName>;

export type Results<
  T extends SchemaName,
  IsRealm extends boolean = false,
> = Realm.Results<
  IsRealm extends true ? Realm.Object<SchemaModel<T>> : SchemaModel<T>
>;

/**
 * Removes the realm alrgument (first argument) from the type of a helper
 * function. Used when wrapping helpers with injected realm.
 */
export type OmitRealmArg<F> = F extends (
  realm: Realm,
  ...args: infer P
) => infer R
  ? (...args: P) => R
  : never;

type OverriddenOperations = {
  create: <T extends SchemaName>(
    model: T,
    data: SchemaModel<T>,
    updateMode?: Realm.UpdateMode,
  ) => SchemaModel<T>;
  update: <T extends SchemaName>(
    model: T,
    data: Partial<SchemaModel<T>>,
    updateMode?: Realm.UpdateMode,
  ) => SchemaModel<T>;
  getObject: <T extends SchemaName>(
    model: T,
    id: SchemaValue<T>,
  ) => SchemaModel<T> | null;
  getObjects: <T extends SchemaName>(
    model: T,
    query?: QueryFn<T>,
  ) => ReadonlyArray<SchemaModel<T>>;
};

export type WrappedOperations<
  AllOperations extends {[K: string]: (realm: Realm, ...args: any[]) => any},
> = OverriddenOperations & {
  [K in keyof Omit<AllOperations, keyof OverriddenOperations>]: OmitRealmArg<
    AllOperations[K]
  >;
};

export type QueryFn<T extends SchemaName, IsRealm extends boolean = false> = (
  collection: Results<T, IsRealm>,
) => Results<T, IsRealm>;
