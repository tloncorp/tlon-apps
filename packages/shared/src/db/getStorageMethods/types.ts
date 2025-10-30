export interface StorageMethods {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export type GetStorageMethods = (isSecure: boolean) => StorageMethods;
