export interface StorageAdapter {
  initialize(): Promise<void>;
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

export interface SQLStorageAdapter extends StorageAdapter {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(callback: (tx: SQLTransaction) => Promise<T>): Promise<T>;
}

export interface SQLTransaction {
  executeSql<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
