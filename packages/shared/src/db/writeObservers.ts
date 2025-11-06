type WriteCallback<T> = (data: T) => void;

const observers = new Map<string, Set<WriteCallback<any>>>();

export enum ObservableField {
  BaseUnread = 'baseUnread',
}

export function observeWrites<T>(
  queryLabel: ObservableField,
  callback: WriteCallback<T>
) {
  if (!observers.has(queryLabel)) {
    observers.set(queryLabel, new Set());
  }
  observers.get(queryLabel)!.add(callback);

  return () => observers.get(queryLabel)?.delete(callback);
}

export function notifyWriteObservers<T>(queryLabel: ObservableField, data: T) {
  observers.get(queryLabel)?.forEach((cb) => cb(data));
}
