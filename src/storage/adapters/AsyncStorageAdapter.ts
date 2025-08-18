import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAdapter, StorageError } from './StorageAdapter';

export class AsyncStorageAdapter implements StorageAdapter {
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      await AsyncStorage.getItem('__test__');
      this.isInitialized = true;
    } catch (error) {
      throw new StorageError(
        'Failed to initialize AsyncStorage',
        'ASYNC_STORAGE_INIT_ERROR',
        error as Error,
      );
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.ensureInitialized();
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      throw new StorageError(
        `Failed to get item: ${key}`,
        'ASYNC_STORAGE_GET_ERROR',
        error as Error,
      );
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.ensureInitialized();
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new StorageError(
        `Failed to set item: ${key}`,
        'ASYNC_STORAGE_SET_ERROR',
        error as Error,
      );
    }
  }

  async remove(key: string): Promise<void> {
    this.ensureInitialized();
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      throw new StorageError(
        `Failed to remove item: ${key}`,
        'ASYNC_STORAGE_REMOVE_ERROR',
        error as Error,
      );
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    try {
      await AsyncStorage.clear();
    } catch (error) {
      throw new StorageError(
        'Failed to clear AsyncStorage',
        'ASYNC_STORAGE_CLEAR_ERROR',
        error as Error,
      );
    }
  }

  async getAllKeys(): Promise<string[]> {
    this.ensureInitialized();
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys]; // Convert readonly array to mutable array
    } catch (error) {
      throw new StorageError(
        'Failed to get all keys',
        'ASYNC_STORAGE_KEYS_ERROR',
        error as Error,
      );
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new StorageError(
        'AsyncStorageAdapter not initialized',
        'ASYNC_STORAGE_NOT_INITIALIZED',
      );
    }
  }
}