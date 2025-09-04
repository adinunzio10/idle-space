/**
 * WorkletDataIsolation.ts
 * 
 * Utility functions to prevent React Native Reanimated object mutation warnings
 * by creating isolated copies of data before passing to worklets.
 * 
 * This module addresses the warning:
 * "tried to modify key of an object which has been already passed to a worklet"
 */

import { Beacon } from '../../types/galaxy';

/**
 * Interface for worklet-safe beacon render data
 * All properties are readonly to prevent accidental mutation
 */
export interface BeaconWorkletData {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
  readonly glowSize: number;
  readonly glowOpacity: number;
  readonly level: number;
  readonly type: Beacon['type'];
  readonly active: boolean;
}

/**
 * Interface for worklet-safe animation data
 */
export interface AnimationWorkletData {
  readonly opacity: number;
  readonly scale: number;
  readonly rotation?: number;
  readonly translateX?: number;
  readonly translateY?: number;
}

/**
 * Creates a deep clone of an object suitable for worklet consumption.
 * Uses structured cloning to ensure complete isolation.
 */
export function createWorkletSafeClone<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // For simple objects, use JSON method for performance
  if (isSimpleObject(obj)) {
    return JSON.parse(JSON.stringify(obj));
  }

  // For complex objects, use structured cloning approach
  return structuredClone(obj);
}

/**
 * Creates a worklet-safe copy of beacon render data
 * This function ensures all beacon properties are isolated for worklet use
 */
export function cloneBeaconRenderData(data: {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  glowSize: number;
  glowOpacity: number;
  level: number;
  type: Beacon['type'];
  active: boolean;
}): BeaconWorkletData {
  return {
    id: data.id,
    x: data.x,
    y: data.y,
    size: data.size,
    color: data.color,
    glowSize: data.glowSize,
    glowOpacity: data.glowOpacity,
    level: data.level,
    type: data.type,
    active: data.active,
  };
}

/**
 * Creates a worklet-safe copy of animation data
 */
export function cloneAnimationData(data: {
  opacity: number;
  scale: number;
  rotation?: number;
  translateX?: number;
  translateY?: number;
}): AnimationWorkletData {
  return {
    opacity: data.opacity,
    scale: data.scale,
    rotation: data.rotation,
    translateX: data.translateX,
    translateY: data.translateY,
  };
}

/**
 * Object pool for frequently used worklet data to prevent GC pressure
 */
class WorkletDataPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (item: T) => void;
  private maxSize: number;

  constructor(createFn: () => T, resetFn: (item: T) => void, maxSize = 50) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    const item = this.pool.pop();
    if (item) {
      return item;
    }
    return this.createFn();
  }

  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(item);
      this.pool.push(item);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }

  getPoolSize(): number {
    return this.pool.length;
  }
}

/**
 * Pooled beacon worklet data for performance optimization
 */
const beaconWorkletDataPool = new WorkletDataPool<BeaconWorkletData>(
  () => ({
    id: '',
    x: 0,
    y: 0,
    size: 0,
    color: '',
    glowSize: 0,
    glowOpacity: 0,
    level: 0,
    type: 'pioneer' as const,
    active: false,
  }),
  (item) => {
    // Reset to default values
    (item as any).id = '';
    (item as any).x = 0;
    (item as any).y = 0;
    (item as any).size = 0;
    (item as any).color = '';
    (item as any).glowSize = 0;
    (item as any).glowOpacity = 0;
    (item as any).level = 0;
    (item as any).type = 'pioneer';
    (item as any).active = false;
  }
);

/**
 * Pooled animation worklet data for performance optimization
 */
const animationWorkletDataPool = new WorkletDataPool<AnimationWorkletData>(
  () => ({
    opacity: 1,
    scale: 1,
    rotation: 0,
    translateX: 0,
    translateY: 0,
  }),
  (item) => {
    (item as any).opacity = 1;
    (item as any).scale = 1;
    (item as any).rotation = 0;
    (item as any).translateX = 0;
    (item as any).translateY = 0;
  }
);

/**
 * Gets a pooled beacon worklet data object and populates it with the provided data
 */
export function getPooledBeaconWorkletData(data: {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  glowSize: number;
  glowOpacity: number;
  level: number;
  type: Beacon['type'];
  active: boolean;
}): BeaconWorkletData {
  const pooledData = beaconWorkletDataPool.acquire();
  
  // Populate with new data
  (pooledData as any).id = data.id;
  (pooledData as any).x = data.x;
  (pooledData as any).y = data.y;
  (pooledData as any).size = data.size;
  (pooledData as any).color = data.color;
  (pooledData as any).glowSize = data.glowSize;
  (pooledData as any).glowOpacity = data.glowOpacity;
  (pooledData as any).level = data.level;
  (pooledData as any).type = data.type;
  (pooledData as any).active = data.active;
  
  return pooledData;
}

/**
 * Returns a pooled beacon worklet data object to the pool
 */
export function releasePooledBeaconWorkletData(data: BeaconWorkletData): void {
  beaconWorkletDataPool.release(data);
}

/**
 * Gets a pooled animation worklet data object and populates it with the provided data
 */
export function getPooledAnimationWorkletData(data: {
  opacity: number;
  scale: number;
  rotation?: number;
  translateX?: number;
  translateY?: number;
}): AnimationWorkletData {
  const pooledData = animationWorkletDataPool.acquire();
  
  (pooledData as any).opacity = data.opacity;
  (pooledData as any).scale = data.scale;
  (pooledData as any).rotation = data.rotation || 0;
  (pooledData as any).translateX = data.translateX || 0;
  (pooledData as any).translateY = data.translateY || 0;
  
  return pooledData;
}

/**
 * Returns a pooled animation worklet data object to the pool
 */
export function releasePooledAnimationWorkletData(data: AnimationWorkletData): void {
  animationWorkletDataPool.release(data);
}

/**
 * Freezes an object to prevent mutations (development mode only)
 */
export function freezeForWorklet<T extends Record<string, any>>(obj: T): Readonly<T> {
  if (__DEV__) {
    return Object.freeze(obj);
  }
  return obj as Readonly<T>;
}

/**
 * Creates a worklet-safe data factory that ensures proper isolation
 */
export function createWorkletDataFactory<TInput, TOutput extends Record<string, any>>(
  transformer: (input: TInput) => TOutput
): (input: TInput) => Readonly<TOutput> {
  return (input: TInput) => {
    const result = transformer(input);
    return freezeForWorklet(result);
  };
}

/**
 * Helper to check if an object is simple (only primitives and simple nested objects)
 */
function isSimpleObject(obj: any): boolean {
  if (obj === null || typeof obj !== 'object') {
    return true;
  }

  if (obj instanceof Date || obj instanceof RegExp || obj instanceof Function) {
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.every(isSimpleObject);
  }

  for (const key in obj) {
    if (!isSimpleObject(obj[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Cleanup function to clear all pools (useful for testing or memory management)
 */
export function clearAllWorkletPools(): void {
  beaconWorkletDataPool.clear();
  animationWorkletDataPool.clear();
}

/**
 * Get pool statistics for monitoring
 */
export function getWorkletPoolStats() {
  return {
    beaconPoolSize: beaconWorkletDataPool.getPoolSize(),
    animationPoolSize: animationWorkletDataPool.getPoolSize(),
  };
}

/**
 * Global development flag to enable/disable worklet data validation
 */
export const WORKLET_VALIDATION_ENABLED = __DEV__;

/**
 * Validates that worklet data doesn't contain functions or complex objects
 */
export function validateWorkletData(data: any, context = 'unknown'): void {
  if (!WORKLET_VALIDATION_ENABLED) return;

  const validateValue = (value: any, path = ''): void => {
    if (typeof value === 'function') {
      console.warn(`[WorkletDataIsolation] Function found in worklet data at ${path} (context: ${context})`);
    }
    
    if (value && typeof value === 'object') {
      if (value instanceof Date || value instanceof RegExp) {
        console.warn(`[WorkletDataIsolation] Complex object found in worklet data at ${path} (context: ${context})`);
      }
      
      if (Array.isArray(value)) {
        value.forEach((item, index) => validateValue(item, `${path}[${index}]`));
      } else {
        for (const key in value) {
          validateValue(value[key], `${path}.${key}`);
        }
      }
    }
  };

  validateValue(data);
}