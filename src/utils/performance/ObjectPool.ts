/**
 * Generic object pool for performance optimization
 * Reduces garbage collection pressure by reusing objects
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (obj: T) => void;
  private maxSize: number;
  private created: number = 0;

  constructor(
    createFn: () => T,
    resetFn?: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  /**
   * Get an object from the pool, creating one if necessary
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    this.created++;
    return this.createFn();
  }

  /**
   * Return an object to the pool for reuse
   */
  release(obj: T): void {
    if (this.pool.length >= this.maxSize) {
      return; // Pool is full, let object be garbage collected
    }

    if (this.resetFn) {
      this.resetFn(obj);
    }

    this.pool.push(obj);
  }

  /**
   * Pre-populate the pool with objects
   */
  preallocate(count: number): void {
    for (let i = 0; i < count && this.pool.length < this.maxSize; i++) {
      this.pool.push(this.createFn());
      this.created++;
    }
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number;
    maxSize: number;
    totalCreated: number;
    utilizationRate: number;
  } {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      totalCreated: this.created,
      utilizationRate:
        this.created > 0 ? (this.created - this.pool.length) / this.created : 0,
    };
  }
}

/**
 * Particle object for pooling
 */
export interface PooledParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  opacity: number;
  active: boolean;
}

/**
 * Create a particle pool for effects
 */
export function createParticlePool(
  maxSize: number = 200
): ObjectPool<PooledParticle> {
  return new ObjectPool<PooledParticle>(
    () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1000,
      size: 2,
      color: '#FFFFFF',
      opacity: 1,
      active: false,
    }),
    particle => {
      particle.x = 0;
      particle.y = 0;
      particle.vx = 0;
      particle.vy = 0;
      particle.life = 0;
      particle.maxLife = 1000;
      particle.size = 2;
      particle.color = '#FFFFFF';
      particle.opacity = 1;
      particle.active = false;
    },
    maxSize
  );
}

/**
 * Animation state object for pooling
 */
export interface PooledAnimationState {
  id: string;
  startTime: number;
  duration: number;
  progress: number;
  easing: (t: number) => number;
  active: boolean;
  onComplete?: () => void;
}

/**
 * Create an animation state pool
 */
export function createAnimationPool(
  maxSize: number = 50
): ObjectPool<PooledAnimationState> {
  return new ObjectPool<PooledAnimationState>(
    () => ({
      id: '',
      startTime: 0,
      duration: 1000,
      progress: 0,
      easing: t => t,
      active: false,
    }),
    anim => {
      anim.id = '';
      anim.startTime = 0;
      anim.duration = 1000;
      anim.progress = 0;
      anim.easing = t => t;
      anim.active = false;
      anim.onComplete = undefined;
    },
    maxSize
  );
}

/**
 * Beacon render data for pooling
 */
export interface PooledBeaconRenderData {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  glowSize: number;
  glowOpacity: number;
  level: number;
  type: string;
  active: boolean;
}

/**
 * Create a beacon render data pool
 */
export function createBeaconRenderPool(
  maxSize: number = 1000
): ObjectPool<PooledBeaconRenderData> {
  return new ObjectPool<PooledBeaconRenderData>(
    () => ({
      id: '',
      x: 0,
      y: 0,
      size: 16,
      color: '#4F46E5',
      glowSize: 24,
      glowOpacity: 0.6,
      level: 1,
      type: 'pioneer',
      active: false,
    }),
    beacon => {
      beacon.id = '';
      beacon.x = 0;
      beacon.y = 0;
      beacon.size = 16;
      beacon.color = '#4F46E5';
      beacon.glowSize = 24;
      beacon.glowOpacity = 0.6;
      beacon.level = 1;
      beacon.type = 'pioneer';
      beacon.active = false;
    },
    maxSize
  );
}

/**
 * Global pool manager for centralized pool management
 */
class PoolManager {
  private pools: Map<string, ObjectPool<any>> = new Map();

  registerPool<T>(name: string, pool: ObjectPool<T>): void {
    this.pools.set(name, pool);
  }

  getPool<T>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name);
  }

  clearAll(): void {
    this.pools.forEach(pool => pool.clear());
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.pools.forEach((pool, name) => {
      stats[name] = pool.getStats();
    });
    return stats;
  }

  /**
   * Initialize default pools
   */
  initialize(): void {
    this.registerPool('particles', createParticlePool(200));
    this.registerPool('animations', createAnimationPool(50));
    this.registerPool('beaconRender', createBeaconRenderPool(1000));
  }
}

export const poolManager = new PoolManager();

// Initialize pools on module load
poolManager.initialize();
