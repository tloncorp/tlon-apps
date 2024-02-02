import {DependencyList, useMemo} from 'react';
import Realm from 'realm';
import * as queries from './ops';
import * as rlm from './realm';
import {
  PrimarySchemaName,
  QueryFn,
  SchemaModel,
  SchemaName,
  SchemaValue,
  WrappedOperations,
} from './types';

export const useOps = () => {
  const realm = rlm.useRealm();
  return useMemo(() => {
    // Pulling these out because they're generic and I haven't figured out a way to
    // get typing to work for them
    const {create, update, getObject, getObjects, ...basicQueries} = queries;
    return {
      create: <T extends PrimarySchemaName>(
        model: T,
        data: SchemaModel<T>,
        updateMode = Realm.UpdateMode.Modified,
      ) => create(realm, model, data, updateMode),
      update: <T extends PrimarySchemaName>(
        model: T,
        data: Partial<SchemaModel<T>>,
        updateMode = Realm.UpdateMode.Modified,
      ) => update(realm, model, data, updateMode),
      getObject: <T extends PrimarySchemaName>(model: T, id: SchemaValue<T>) =>
        getObject(realm, model, id),
      getObjects: <T extends PrimarySchemaName>(model: T, query?: QueryFn<T>) =>
        getObjects(realm, model, query),
      ...Object.fromEntries(
        Object.entries(basicQueries).map(([k, v]) => {
          // Using apply here to avoid ts complaining about the number of arguments
          return [k, (...args: any[]) => v.apply(null, [realm, ...args])];
        }),
      ),
    } as WrappedOperations<typeof queries>;
  }, [realm]);
};

export type Operations = ReturnType<typeof useOps>;

export function useQuery<T extends SchemaName>(
  model: T,
  query: QueryFn<T>,
  deps: DependencyList,
): ReadonlyArray<SchemaModel<T>> {
  return rlm.useQuery<SchemaModel<T>>(
    model,
    query,
    deps,
  ) as unknown as ReadonlyArray<SchemaModel<T>>;
}

export function useObject<T extends SchemaName>(
  model: T,
  primaryKey: SchemaValue<T>,
): SchemaModel<T> | null {
  return rlm.useObject<SchemaModel<T>>(model, primaryKey);
}
