import { ObjectPool, PooledParticle, poolManager } from '../performance/ObjectPool';

/**
 * Particle system configuration
 */
export interface ParticleSystemConfig {
  maxParticles: number;
  emissionRate: number; // particles per second
  particleLifetime: number; // milliseconds
  startSize: number;
  endSize: number;
  startOpacity: number;
  endOpacity: number;
  gravity: number;
  velocity: {
    x: { min: number; max: number };
    y: { min: number; max: number };
  };
  colors: string[];
}

/**
 * Particle emitter types
 */
export enum ParticleEmitterType {
  BEACON_PULSE = 'beacon_pulse',
  PROBE_TRAIL = 'probe_trail',
  CONNECTION_SPARK = 'connection_spark',
  LEVEL_UP = 'level_up',
  QUANTUM_BURST = 'quantum_burst',
}

/**
 * Predefined particle configurations
 */
export const PARTICLE_CONFIGS: Record<ParticleEmitterType, ParticleSystemConfig> = {
  [ParticleEmitterType.BEACON_PULSE]: {
    maxParticles: 20,
    emissionRate: 10,
    particleLifetime: 2000,
    startSize: 2,
    endSize: 4,
    startOpacity: 0.8,
    endOpacity: 0,
    gravity: 0,
    velocity: {
      x: { min: -20, max: 20 },
      y: { min: -20, max: 20 },
    },
    colors: ['#4F46E5', '#6366F1', '#818CF8'],
  },
  [ParticleEmitterType.PROBE_TRAIL]: {
    maxParticles: 15,
    emissionRate: 30,
    particleLifetime: 1000,
    startSize: 1,
    endSize: 0.5,
    startOpacity: 1,
    endOpacity: 0,
    gravity: 0,
    velocity: {
      x: { min: -5, max: 5 },
      y: { min: -5, max: 5 },
    },
    colors: ['#10B981', '#34D399', '#6EE7B7'],
  },
  [ParticleEmitterType.CONNECTION_SPARK]: {
    maxParticles: 10,
    emissionRate: 5,
    particleLifetime: 1500,
    startSize: 1.5,
    endSize: 0,
    startOpacity: 0.9,
    endOpacity: 0,
    gravity: 0,
    velocity: {
      x: { min: -10, max: 10 },
      y: { min: -10, max: 10 },
    },
    colors: ['#F59E0B', '#FBBF24', '#FCD34D'],
  },
  [ParticleEmitterType.LEVEL_UP]: {
    maxParticles: 50,
    emissionRate: 25,
    particleLifetime: 3000,
    startSize: 3,
    endSize: 1,
    startOpacity: 1,
    endOpacity: 0,
    gravity: -20,
    velocity: {
      x: { min: -50, max: 50 },
      y: { min: -30, max: -80 },
    },
    colors: ['#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD'],
  },
  [ParticleEmitterType.QUANTUM_BURST]: {
    maxParticles: 30,
    emissionRate: 60,
    particleLifetime: 2500,
    startSize: 2,
    endSize: 6,
    startOpacity: 0.8,
    endOpacity: 0,
    gravity: 0,
    velocity: {
      x: { min: -80, max: 80 },
      y: { min: -80, max: 80 },
    },
    colors: ['#EF4444', '#F87171', '#FCA5A5', '#FECACA'],
  },
};

/**
 * Particle system using object pooling for performance
 */
export class ParticleSystem {
  private particles: PooledParticle[] = [];
  private pool: ObjectPool<PooledParticle>;
  private config: ParticleSystemConfig;
  private position: { x: number; y: number } = { x: 0, y: 0 };
  private isActive: boolean = false;
  private lastEmissionTime: number = 0;
  private accumulatedTime: number = 0;

  constructor(
    type: ParticleEmitterType,
    customConfig?: Partial<ParticleSystemConfig>
  ) {
    this.config = { ...PARTICLE_CONFIGS[type], ...customConfig };
    this.pool = poolManager.getPool('particles') || new ObjectPool(() => this.createParticle(), (p) => this.resetParticle(p));
  }

  /**
   * Set the emitter position
   */
  setPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Start particle emission
   */
  start(): void {
    this.isActive = true;
    this.lastEmissionTime = Date.now();
  }

  /**
   * Stop particle emission (existing particles will continue)
   */
  stop(): void {
    this.isActive = false;
  }

  /**
   * Pause/resume without clearing particles
   */
  setPaused(paused: boolean): void {
    this.isActive = !paused;
    if (!paused) {
      this.lastEmissionTime = Date.now();
    }
  }

  /**
   * Clear all particles and return them to the pool
   */
  clear(): void {
    this.particles.forEach(particle => {
      particle.active = false;
      this.pool.release(particle);
    });
    this.particles.length = 0;
  }

  /**
   * Update particle system
   */
  update(deltaTime: number): void {
    const now = Date.now();
    
    // Emit new particles if active
    if (this.isActive && this.particles.length < this.config.maxParticles) {
      this.accumulatedTime += deltaTime;
      const emissionInterval = 1000 / this.config.emissionRate;
      
      while (this.accumulatedTime >= emissionInterval && this.particles.length < this.config.maxParticles) {
        this.emitParticle();
        this.accumulatedTime -= emissionInterval;
      }
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      if (!particle.active) {
        this.particles.splice(i, 1);
        this.pool.release(particle);
        continue;
      }

      // Update particle physics
      particle.x += particle.vx * (deltaTime / 1000);
      particle.y += particle.vy * (deltaTime / 1000);
      particle.vy += this.config.gravity * (deltaTime / 1000);
      
      // Update particle life
      particle.life += deltaTime;
      
      if (particle.life >= particle.maxLife) {
        particle.active = false;
        continue;
      }

      // Update visual properties
      const lifeProgress = particle.life / particle.maxLife;
      particle.opacity = this.lerp(
        this.config.startOpacity,
        this.config.endOpacity,
        lifeProgress
      );
      particle.size = this.lerp(
        this.config.startSize,
        this.config.endSize,
        lifeProgress
      );
    }
  }

  /**
   * Emit a single particle
   */
  private emitParticle(): void {
    const particle = this.pool.acquire();
    
    particle.x = this.position.x;
    particle.y = this.position.y;
    particle.vx = this.randomBetween(this.config.velocity.x.min, this.config.velocity.x.max);
    particle.vy = this.randomBetween(this.config.velocity.y.min, this.config.velocity.y.max);
    particle.life = 0;
    particle.maxLife = this.config.particleLifetime;
    particle.size = this.config.startSize;
    particle.opacity = this.config.startOpacity;
    particle.color = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
    particle.active = true;

    this.particles.push(particle);
  }

  /**
   * Create a new particle (for pool)
   */
  private createParticle(): PooledParticle {
    return {
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
    };
  }

  /**
   * Reset a particle for pool reuse
   */
  private resetParticle(particle: PooledParticle): void {
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
  }

  /**
   * Get active particles for rendering
   */
  getParticles(): PooledParticle[] {
    return this.particles.filter(p => p.active);
  }

  /**
   * Get particle count statistics
   */
  getStats(): {
    activeParticles: number;
    maxParticles: number;
    poolStats: any;
  } {
    return {
      activeParticles: this.particles.length,
      maxParticles: this.config.maxParticles,
      poolStats: this.pool.getStats(),
    };
  }

  /**
   * Utility: Linear interpolation
   */
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  /**
   * Utility: Random number between min and max
   */
  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}

/**
 * Global particle manager for coordinating multiple particle systems
 */
class ParticleManager {
  private systems: Map<string, ParticleSystem> = new Map();
  private lastUpdateTime: number = Date.now();
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  /**
   * Create a particle system
   */
  createSystem(
    id: string, 
    type: ParticleEmitterType, 
    config?: Partial<ParticleSystemConfig>
  ): ParticleSystem {
    const system = new ParticleSystem(type, config);
    this.systems.set(id, system);
    
    if (!this.isRunning) {
      this.start();
    }
    
    return system;
  }

  /**
   * Remove a particle system
   */
  removeSystem(id: string): void {
    const system = this.systems.get(id);
    if (system) {
      system.clear();
      this.systems.delete(id);
    }

    if (this.systems.size === 0 && this.isRunning) {
      this.stop();
    }
  }

  /**
   * Get a particle system
   */
  getSystem(id: string): ParticleSystem | undefined {
    return this.systems.get(id);
  }

  /**
   * Start the global update loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
    this.update();
  }

  /**
   * Stop the global update loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Clear all particle systems
   */
  clearAll(): void {
    this.systems.forEach(system => system.clear());
    this.systems.clear();
    this.stop();
  }

  /**
   * Update all particle systems
   */
  private update = (): void => {
    if (!this.isRunning) return;

    const now = Date.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    this.systems.forEach(system => system.update(deltaTime));

    this.animationFrameId = requestAnimationFrame(this.update);
  };

  /**
   * Get statistics for all systems
   */
  getGlobalStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.systems.forEach((system, id) => {
      stats[id] = system.getStats();
    });
    return stats;
  }
}

export const particleManager = new ParticleManager();