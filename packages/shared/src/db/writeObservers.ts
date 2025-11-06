type WriteCallback<T> = (data: T) => void;

const observers = new Map<string, Set<WriteCallback<any>>>();

export enum ObservableField {
  BaseUnread = 'baseUnread',
}

export function observeWrites<T>(
  field: ObservableField,
  callback: WriteCallback<T>
) {
  if (!observers.has(field)) {
    observers.set(field, new Set());
  }
  observers.get(field)!.add(callback);

  return () => observers.get(field)?.delete(callback);
}

export function notifyWriteObservers<T>(field: ObservableField, data: T) {
  observers.get(field)?.forEach((cb) => cb(data));
}
