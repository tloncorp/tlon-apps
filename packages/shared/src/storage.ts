import * as React from 'react';

// This is a supertype of react-native-storage's `Storage`: we shouldn't add
// that dependency to this package, but we can match the type structurally to
// avoid an adapter.
interface Storage {
  save(params: {
    key: string;
    id?: string;
    data: unknown;
    expires?: number | null;
  }): Promise<void>;
  load<T = unknown>(params: {
    key: string;
    id?: string;
    autoSync?: boolean;
    syncInBackground?: boolean;
    syncParams?: unknown;
  }): Promise<T>;
  remove(params: { key: string; id?: string }): Promise<void>;
}

export const StorageContext = React.createContext<Storage | null>(null);
