import {
  AnyPrimaryModel,
  PrimarySchemaName,
  Results,
  SchemaModel,
  SchemaName,
} from './types';

/**
 * Forcibly casts a realm results object to a plain, read-only array. Results and the
 * plain array are functionally identical in practice, but there's a subtlety
 * with scopeables that causes issues.
 *
 * Uncomment these lines if you want to check out the error:
 * let results: Realm.Results<any>;
 * let arrayResults = results as ReadonlyArray<any>;
 */
export function asReadOnlyArray<T extends SchemaName>(
  results: Results<T>,
): ReadonlyArray<SchemaModel<T>> {
  return results as unknown as ReadonlyArray<SchemaModel<T>>;
}

// Collection Proxy

const numericRegEx = /^-?\d+$/;

function getCacheKey(id: string) {
  return `${id}`;
}

/**
 * Ensure objects in a collection maintain referential equality.
 *
 * Mostly taken from here:
 * https://github.com/realm/realm-js/blob/main/packages/realm-react/src/cachedCollection.ts
 * Difference is that this version does not update when the query updates, and
 * therefore *shouldn't* (famous last words) need to be manually disposed.
 *
 * The reason that this is necessary is that objects returned from
 * `realm.objects` are proxied by default and do not have referential equality.
 * So, `objectA === objectA` will always return falso, wreaking havoc on  memoized
 * components. This is not the case for `useQuery` results, which are wrapped in
 * the above-mentioned `cachedCollection`.
 */
export const createCachingCollectionProxy = <T extends PrimarySchemaName>(
  collection: Results<T>,
): Results<T> => {
  const objectCache = new Map<string, SchemaModel<T>>();
  const cachedCollectionHandler: ProxyHandler<Results<T>> = {
    get: function (target, key, receiver) {
      // Pass functions through
      const value = Reflect.get(target, key, receiver);
      if (typeof value === 'function') {
        return value;
      }

      // If the key is not numeric, pass it through
      if (typeof key === 'symbol' || !numericRegEx.test(key)) {
        return value;
      }

      // If the key is numeric, check if we have a cached object for this key
      const index = Number(key);
      const object = target[index];

      // If the collection is modeled in a way that objects can be null
      // then we should return null instead of undefined to stay semantically
      // correct
      if (object === null) {
        return null;
      } else if (typeof object === 'undefined') {
        // If there is no object at this index, return undefined
        return undefined;
      }

      const objectId = getObjectId(object);
      const cacheKey = getCacheKey(objectId);

      // If we do, return it...
      if (objectCache.get(cacheKey)) {
        return objectCache.get(cacheKey);
      }

      // If not then this index has either not been accessed before, or has been invalidated due
      // to a modification. Fetch it from the collection and store it in the cache
      objectCache.set(cacheKey, object);

      return object;
    },
  };

  return new Proxy(collection, cachedCollectionHandler);
};

export const getObjectId = <T extends AnyPrimaryModel>(item: T) => {
  return item.id;
};
