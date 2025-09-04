/**
 * OverlayOptimization - Advanced Viewport Culling and LOD System
 * 
 * Provides sophisticated optimization techniques for galaxy sector overlay rendering
 * including spatial culling, level-of-detail management, occlusion testing, and
 * adaptive performance scaling based on device capabilities and frame rate.
 */

import { GalacticSector, StarSystem, ViewportState, ViewportBounds } from '../../types/galaxy';

export interface CullingResult<T> {
  visible: T[];
  culled: T[];
  totalTested: number;
  cullingTime: number;
}

export interface LODLevel {
  level: number;
  name: string;
  maxDistance: number;
  maxObjects: number;
  enableAnimations: boolean;
  enableParticles: boolean;
  enableGlowEffects: boolean;
  particleQuality: number;
  renderComplexity: number; // 0-1 scale
}

export interface ViewportCulling {
  /** Test if object bounds intersect with viewport */
  testBounds: (bounds: ViewportBounds, viewport: ViewportBounds) => boolean;
  /** Calculate distance from viewport center */
  getDistanceFromCenter: (position: { x: number; y: number }, viewport: ViewportState) => number;
  /** Perform frustum culling for sectors */
  cullSectors: (sectors: GalacticSector[], viewport: ViewportState, maxObjects?: number) => CullingResult<GalacticSector>;
  /** Perform frustum culling for star systems */
  cullStarSystems: (starSystems: StarSystem[], viewport: ViewportState, maxObjects?: number) => CullingResult<StarSystem>;
  /** Advanced spatial culling with priority sorting */
  cullByPriority: <T extends { id: string; position: { x: number; y: number } }>(
    objects: T[], 
    viewport: ViewportState, 
    priorityFunction: (obj: T, viewport: ViewportState) => number,
    maxObjects?: number
  ) => CullingResult<T>;
}

export interface LODManager {
  /** Calculate appropriate LOD level for given viewport */
  calculateLODLevel: (viewport: ViewportState) => LODLevel;
  /** Get LOD settings for distance from viewport center */
  getLODForDistance: (distance: number, maxDistance: number) => LODLevel;
  /** Adapt LOD based on performance metrics */
  adaptiveLOD: (viewport: ViewportState, frameTime: number, targetFrameTime: number) => LODLevel;
  /** Get all available LOD levels */
  getLevels: () => LODLevel[];
}

export interface PerformanceAdaptation {
  /** Monitor frame time and adjust quality */
  monitorPerformance: (frameTime: number) => void;
  /** Get current performance metrics */
  getMetrics: () => PerformanceMetrics;
  /** Get recommended quality settings */
  getRecommendedQuality: () => QualitySettings;
  /** Reset performance tracking */
  reset: () => void;
}

export interface PerformanceMetrics {
  averageFrameTime: number;
  frameTimeHistory: number[];
  droppedFrames: number;
  totalFrames: number;
  performanceScore: number; // 0-1, higher is better
  stabilityScore: number; // 0-1, higher is more stable
}

export interface QualitySettings {
  maxSectors: number;
  maxStarSystems: number;
  maxParticles: number;
  enableAnimations: boolean;
  enableParticles: boolean;
  enableGlow: boolean;
  particleQuality: number;
  lodBias: number; // Multiplier for LOD distances
}

// LOD Level definitions
const LOD_LEVELS: LODLevel[] = [
  {
    level: 0,
    name: 'Minimal',
    maxDistance: 50,
    maxObjects: 10,
    enableAnimations: false,
    enableParticles: false,
    enableGlowEffects: false,
    particleQuality: 0,
    renderComplexity: 0.1,
  },
  {
    level: 1,
    name: 'Low',
    maxDistance: 150,
    maxObjects: 25,
    enableAnimations: false,
    enableParticles: false,
    enableGlowEffects: false,
    particleQuality: 0.2,
    renderComplexity: 0.3,
  },
  {
    level: 2,
    name: 'Medium',
    maxDistance: 400,
    maxObjects: 50,
    enableAnimations: true,
    enableParticles: true,
    enableGlowEffects: false,
    particleQuality: 0.6,
    renderComplexity: 0.6,
  },
  {
    level: 3,
    name: 'High',
    maxDistance: 800,
    maxObjects: 100,
    enableAnimations: true,
    enableParticles: true,
    enableGlowEffects: true,
    particleQuality: 0.8,
    renderComplexity: 0.8,
  },
  {
    level: 4,
    name: 'Ultra',
    maxDistance: Infinity,
    maxObjects: 200,
    enableAnimations: true,
    enableParticles: true,
    enableGlowEffects: true,
    particleQuality: 1.0,
    renderComplexity: 1.0,
  },
];

/**
 * Viewport Culling Implementation
 */
class ViewportCullingImpl implements ViewportCulling {
  testBounds(bounds: ViewportBounds, viewport: ViewportBounds): boolean {
    return bounds.minX < viewport.maxX &&
           bounds.maxX > viewport.minX &&
           bounds.minY < viewport.maxY &&
           bounds.maxY > viewport.minY;
  }

  getDistanceFromCenter(position: { x: number; y: number }, viewport: ViewportState): number {
    const centerX = -viewport.translateX / viewport.scale + 400 / viewport.scale; // 800px / 2
    const centerY = -viewport.translateY / viewport.scale + 300 / viewport.scale; // 600px / 2
    
    return Math.hypot(position.x - centerX, position.y - centerY);
  }

  cullSectors(sectors: GalacticSector[], viewport: ViewportState, maxObjects = 100): CullingResult<GalacticSector> {
    const startTime = performance.now();
    
    const viewportBounds = this.calculateViewportBounds(viewport);
    const viewportCenter = this.getViewportCenter(viewport);
    
    const visibleSectors = sectors
      .filter(sector => this.testBounds(sector.bounds, viewportBounds))
      .map(sector => ({
        sector,
        distance: this.getDistanceFromCenter(sector.center, viewport),
        priority: this.calculateSectorPriority(sector, viewport, viewportCenter),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxObjects)
      .map(item => item.sector);

    const culledSectors = sectors.filter(sector => !visibleSectors.includes(sector));
    const cullingTime = performance.now() - startTime;

    return {
      visible: visibleSectors,
      culled: culledSectors,
      totalTested: sectors.length,
      cullingTime,
    };
  }

  cullStarSystems(starSystems: StarSystem[], viewport: ViewportState, maxObjects = 150): CullingResult<StarSystem> {
    const startTime = performance.now();
    
    const viewportBounds = this.calculateViewportBounds(viewport);
    const viewportCenter = this.getViewportCenter(viewport);
    
    const visibleStarSystems = starSystems
      .filter(star => this.isPointInViewport(star.position, viewportBounds))
      .map(star => ({
        star,
        distance: this.getDistanceFromCenter(star.position, viewport),
        priority: this.calculateStarSystemPriority(star, viewport, viewportCenter),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxObjects)
      .map(item => item.star);

    const culledStarSystems = starSystems.filter(star => !visibleStarSystems.includes(star));
    const cullingTime = performance.now() - startTime;

    return {
      visible: visibleStarSystems,
      culled: culledStarSystems,
      totalTested: starSystems.length,
      cullingTime,
    };
  }

  cullByPriority<T extends { id: string; position: { x: number; y: number } }>(
    objects: T[], 
    viewport: ViewportState, 
    priorityFunction: (obj: T, viewport: ViewportState) => number,
    maxObjects = 100
  ): CullingResult<T> {
    const startTime = performance.now();
    
    const viewportBounds = this.calculateViewportBounds(viewport);
    
    const visibleObjects = objects
      .filter(obj => this.isPointInViewport(obj.position, viewportBounds))
      .map(obj => ({
        object: obj,
        priority: priorityFunction(obj, viewport),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxObjects)
      .map(item => item.object);

    const culledObjects = objects.filter(obj => !visibleObjects.includes(obj));
    const cullingTime = performance.now() - startTime;

    return {
      visible: visibleObjects,
      culled: culledObjects,
      totalTested: objects.length,
      cullingTime,
    };
  }

  private calculateViewportBounds(viewport: ViewportState): ViewportBounds {
    const scale = viewport.scale;
    const halfWidth = 400 / scale; // 800px / 2
    const halfHeight = 300 / scale; // 600px / 2
    
    const centerX = -viewport.translateX / scale;
    const centerY = -viewport.translateY / scale;
    
    return {
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minY: centerY - halfHeight,
      maxY: centerY + halfHeight,
    };
  }

  private getViewportCenter(viewport: ViewportState): { x: number; y: number } {
    return {
      x: -viewport.translateX / viewport.scale + 400 / viewport.scale,
      y: -viewport.translateY / viewport.scale + 300 / viewport.scale,
    };
  }

  private isPointInViewport(position: { x: number; y: number }, bounds: ViewportBounds): boolean {
    return position.x >= bounds.minX &&
           position.x <= bounds.maxX &&
           position.y >= bounds.minY &&
           position.y <= bounds.maxY;
  }

  private calculateSectorPriority(sector: GalacticSector, viewport: ViewportState, center: { x: number; y: number }): number {
    const distance = Math.hypot(sector.center.x - center.x, sector.center.y - center.y);
    const maxDistance = 1000; // Maximum meaningful distance
    const distanceScore = 1 - Math.min(1, distance / maxDistance);
    
    // Higher entropy sectors are more interesting
    const entropyScore = sector.entropy;
    
    // Sectors with more star systems are more important
    const systemCountScore = Math.min(1, sector.starSystemIds.length / 10);
    
    return distanceScore * 0.4 + entropyScore * 0.4 + systemCountScore * 0.2;
  }

  private calculateStarSystemPriority(star: StarSystem, viewport: ViewportState, center: { x: number; y: number }): number {
    const distance = Math.hypot(star.position.x - center.x, star.position.y - center.y);
    const maxDistance = 800;
    const distanceScore = 1 - Math.min(1, distance / maxDistance);
    
    // Dying and dead stars are more important than healthy ones
    const stateScore = star.state === 'healthy' ? 0.3 : star.state === 'dying' ? 0.8 : 1.0;
    
    // Stars with resources are more important
    const resourceScore = star.resources ? Math.min(1, 
      ((star.resources.stellarEssence || 0) + (star.resources.voidFragments || 0)) / 20
    ) : 0;
    
    return distanceScore * 0.3 + stateScore * 0.4 + resourceScore * 0.3;
  }
}

/**
 * LOD Manager Implementation
 */
class LODManagerImpl implements LODManager {
  calculateLODLevel(viewport: ViewportState): LODLevel {
    const scale = viewport.scale;
    
    if (scale < 0.3) return LOD_LEVELS[0]; // Minimal
    if (scale < 0.6) return LOD_LEVELS[1]; // Low
    if (scale < 1.2) return LOD_LEVELS[2]; // Medium
    if (scale < 2.5) return LOD_LEVELS[3]; // High
    return LOD_LEVELS[4]; // Ultra
  }

  getLODForDistance(distance: number, maxDistance: number): LODLevel {
    const normalizedDistance = Math.min(1, distance / maxDistance);
    
    if (normalizedDistance > 0.8) return LOD_LEVELS[0];
    if (normalizedDistance > 0.6) return LOD_LEVELS[1];
    if (normalizedDistance > 0.4) return LOD_LEVELS[2];
    if (normalizedDistance > 0.2) return LOD_LEVELS[3];
    return LOD_LEVELS[4];
  }

  adaptiveLOD(viewport: ViewportState, frameTime: number, targetFrameTime: number = 16.67): LODLevel {
    const baseLOD = this.calculateLODLevel(viewport);
    
    // Adjust based on performance
    const performanceRatio = frameTime / targetFrameTime;
    
    if (performanceRatio > 2.0) {
      // Very poor performance - drop to minimal
      return LOD_LEVELS[0];
    } else if (performanceRatio > 1.5) {
      // Poor performance - drop one level
      return LOD_LEVELS[Math.max(0, baseLOD.level - 2)];
    } else if (performanceRatio > 1.2) {
      // Slightly poor performance - minor reduction
      return LOD_LEVELS[Math.max(0, baseLOD.level - 1)];
    } else if (performanceRatio < 0.8) {
      // Good performance - can potentially increase
      return LOD_LEVELS[Math.min(4, baseLOD.level + 1)];
    }
    
    return baseLOD;
  }

  getLevels(): LODLevel[] {
    return [...LOD_LEVELS];
  }
}

/**
 * Performance Adaptation Implementation
 */
class PerformanceAdaptationImpl implements PerformanceAdaptation {
  private frameTimeHistory: number[] = [];
  private droppedFrames = 0;
  private totalFrames = 0;
  private readonly maxHistorySize = 30;
  private readonly targetFrameTime = 16.67; // 60 FPS

  monitorPerformance(frameTime: number): void {
    this.totalFrames++;
    
    // Add to history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.maxHistorySize) {
      this.frameTimeHistory.shift();
    }
    
    // Count dropped frames (> 30ms = < 33 FPS)
    if (frameTime > 30) {
      this.droppedFrames++;
    }
  }

  getMetrics(): PerformanceMetrics {
    const averageFrameTime = this.frameTimeHistory.length > 0 
      ? this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length
      : this.targetFrameTime;

    // Performance score based on how close to target frame time
    const performanceScore = Math.max(0, Math.min(1, 
      1 - (averageFrameTime - this.targetFrameTime) / this.targetFrameTime
    ));

    // Stability score based on frame time variance
    const variance = this.frameTimeHistory.length > 1
      ? this.frameTimeHistory.reduce((sum, time) => 
          sum + Math.pow(time - averageFrameTime, 2), 0
        ) / this.frameTimeHistory.length
      : 0;
    const stabilityScore = Math.max(0, Math.min(1, 1 - variance / 100));

    return {
      averageFrameTime,
      frameTimeHistory: [...this.frameTimeHistory],
      droppedFrames: this.droppedFrames,
      totalFrames: this.totalFrames,
      performanceScore,
      stabilityScore,
    };
  }

  getRecommendedQuality(): QualitySettings {
    const metrics = this.getMetrics();
    
    // Base settings on performance score
    if (metrics.performanceScore < 0.3) {
      // Very poor performance
      return {
        maxSectors: 15,
        maxStarSystems: 25,
        maxParticles: 10,
        enableAnimations: false,
        enableParticles: false,
        enableGlow: false,
        particleQuality: 0.1,
        lodBias: 2.0,
      };
    } else if (metrics.performanceScore < 0.5) {
      // Poor performance
      return {
        maxSectors: 25,
        maxStarSystems: 40,
        maxParticles: 20,
        enableAnimations: false,
        enableParticles: true,
        enableGlow: false,
        particleQuality: 0.3,
        lodBias: 1.5,
      };
    } else if (metrics.performanceScore < 0.7) {
      // Moderate performance
      return {
        maxSectors: 40,
        maxStarSystems: 60,
        maxParticles: 40,
        enableAnimations: true,
        enableParticles: true,
        enableGlow: false,
        particleQuality: 0.6,
        lodBias: 1.2,
      };
    } else if (metrics.performanceScore < 0.85) {
      // Good performance
      return {
        maxSectors: 60,
        maxStarSystems: 100,
        maxParticles: 80,
        enableAnimations: true,
        enableParticles: true,
        enableGlow: true,
        particleQuality: 0.8,
        lodBias: 1.0,
      };
    } else {
      // Excellent performance
      return {
        maxSectors: 100,
        maxStarSystems: 200,
        maxParticles: 150,
        enableAnimations: true,
        enableParticles: true,
        enableGlow: true,
        particleQuality: 1.0,
        lodBias: 0.8,
      };
    }
  }

  reset(): void {
    this.frameTimeHistory = [];
    this.droppedFrames = 0;
    this.totalFrames = 0;
  }
}

/**
 * Create optimization utilities
 */
export function createViewportCulling(): ViewportCulling {
  return new ViewportCullingImpl();
}

export function createLODManager(): LODManager {
  return new LODManagerImpl();
}

export function createPerformanceAdaptation(): PerformanceAdaptation {
  return new PerformanceAdaptationImpl();
}

/**
 * Complete optimization suite
 */
export interface OptimizationSuite {
  culling: ViewportCulling;
  lod: LODManager;
  performance: PerformanceAdaptation;
}

export function createOptimizationSuite(): OptimizationSuite {
  return {
    culling: createViewportCulling(),
    lod: createLODManager(),
    performance: createPerformanceAdaptation(),
  };
}