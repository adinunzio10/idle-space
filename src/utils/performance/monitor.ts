import { InteractionManager } from 'react-native';

/**
 * Performance metrics collected by the monitor
 */
export interface PerformanceMetrics {
  fps: number;
  frameDrops: number;
  memoryUsage: number; // MB
  renderTime: number; // ms
  interactionDelay: number; // ms
  timestamp: number;
}

/**
 * Performance quality levels
 */
export enum PerformanceQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra',
}

/**
 * Performance thresholds for quality adjustment
 */
export interface PerformanceThresholds {
  fps: {
    low: number;
    medium: number;
    high: number;
  };
  frameDropRate: {
    low: number;
    medium: number;
    high: number;
  };
  renderTime: {
    low: number;
    medium: number;
    high: number;
  };
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  fps: {
    low: 30,
    medium: 45,
    high: 55,
  },
  frameDropRate: {
    low: 0.3, // 30% frame drops
    medium: 0.15, // 15% frame drops
    high: 0.05, // 5% frame drops
  },
  renderTime: {
    low: 32, // >32ms (< 30fps)
    medium: 22, // >22ms (< 45fps)
    high: 18, // >18ms (< 55fps)
  },
};

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private frameDrops: number = 0;
  private frameTimes: number[] = [];
  private renderStartTime: number = 0;
  private isMonitoring: boolean = false;
  private thresholds: PerformanceThresholds;
  private currentQuality: PerformanceQuality = PerformanceQuality.HIGH;
  private lastQualityAdjustment: number = 0;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number = 60; // Keep 1 minute of data at 1fps sampling

  constructor(
    thresholds: PerformanceThresholds = DEFAULT_PERFORMANCE_THRESHOLDS
  ) {
    this.thresholds = thresholds;
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    this.isMonitoring = true;
    this.frameCount = 0;
    this.frameDrops = 0;
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
    this.lastQualityAdjustment = Date.now();
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    this.isMonitoring = false;
  }

  /**
   * Record the start of a frame render
   */
  startFrame(): void {
    if (!this.isMonitoring) return;
    this.renderStartTime = performance.now();
  }

  /**
   * Record the end of a frame render
   */
  endFrame(): void {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;

    this.frameCount++;
    this.frameTimes.push(frameTime);

    // Keep only the last 60 frame times (1 second at 60fps)
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    // Detect frame drops (frame time > 16.67ms for 60fps)
    if (frameTime > 16.67) {
      this.frameDrops++;
    }

    this.lastFrameTime = now;

    // Periodically collect metrics and adjust quality
    if (this.frameCount % 60 === 0) {
      this.collectMetrics();
      this.adjustQualityIfNeeded();
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const avgFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((sum, time) => sum + time, 0) /
          this.frameTimes.length
        : 16.67;

    const fps = Math.min(60, 1000 / avgFrameTime);
    const frameDropRate =
      this.frameTimes.length > 0 ? this.frameDrops / this.frameCount : 0;

    return {
      fps,
      frameDrops: frameDropRate,
      memoryUsage: this.getMemoryUsage(),
      renderTime: avgFrameTime,
      interactionDelay: this.measureInteractionDelay(),
      timestamp: Date.now(),
    };
  }

  /**
   * Get current performance quality
   */
  getCurrentQuality(): PerformanceQuality {
    return this.currentQuality;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Manually set performance quality
   */
  setQuality(quality: PerformanceQuality): void {
    this.currentQuality = quality;
    this.lastQualityAdjustment = Date.now();
  }

  /**
   * Get quality settings for rendering
   */
  getQualitySettings(): {
    maxVisibleBeacons: number;
    enableParallax: boolean;
    enableAnimations: boolean;
    lodBias: number;
    starDensity: number;
  } {
    switch (this.currentQuality) {
      case PerformanceQuality.LOW:
        return {
          maxVisibleBeacons: 200,
          enableParallax: false,
          enableAnimations: false,
          lodBias: 2, // More aggressive LOD
          starDensity: 0.3,
        };
      case PerformanceQuality.MEDIUM:
        return {
          maxVisibleBeacons: 350,
          enableParallax: true,
          enableAnimations: false,
          lodBias: 1,
          starDensity: 0.6,
        };
      case PerformanceQuality.HIGH:
        return {
          maxVisibleBeacons: 500,
          enableParallax: true,
          enableAnimations: true,
          lodBias: 0,
          starDensity: 0.8,
        };
      case PerformanceQuality.ULTRA:
        return {
          maxVisibleBeacons: 750,
          enableParallax: true,
          enableAnimations: true,
          lodBias: -1, // Less aggressive LOD
          starDensity: 1.0,
        };
      default:
        return this.getQualitySettings(); // Fallback to current quality
    }
  }

  /**
   * Collect and store current metrics
   */
  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    this.metricsHistory.push(metrics);

    // Keep history size in check
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Automatically adjust quality based on performance
   */
  private adjustQualityIfNeeded(): void {
    const now = Date.now();

    // Don't adjust too frequently (every 5 seconds minimum)
    if (now - this.lastQualityAdjustment < 5000) {
      return;
    }

    const metrics = this.getCurrentMetrics();
    let newQuality = this.currentQuality;

    // Determine if we should decrease quality
    if (
      metrics.fps < this.thresholds.fps.low ||
      metrics.frameDrops > this.thresholds.frameDropRate.low ||
      metrics.renderTime > this.thresholds.renderTime.low
    ) {
      newQuality = this.decreaseQuality(this.currentQuality);
    }
    // Determine if we can increase quality
    else if (
      metrics.fps > this.thresholds.fps.high &&
      metrics.frameDrops < this.thresholds.frameDropRate.high &&
      metrics.renderTime < this.thresholds.renderTime.high
    ) {
      newQuality = this.increaseQuality(this.currentQuality);
    }

    if (newQuality !== this.currentQuality) {
      this.currentQuality = newQuality;
      this.lastQualityAdjustment = now;
      console.log(`Performance quality adjusted to: ${newQuality}`, metrics);
    }
  }

  /**
   * Decrease performance quality
   */
  private decreaseQuality(current: PerformanceQuality): PerformanceQuality {
    switch (current) {
      case PerformanceQuality.ULTRA:
        return PerformanceQuality.HIGH;
      case PerformanceQuality.HIGH:
        return PerformanceQuality.MEDIUM;
      case PerformanceQuality.MEDIUM:
        return PerformanceQuality.LOW;
      case PerformanceQuality.LOW:
        return PerformanceQuality.LOW; // Already at lowest
      default:
        return current;
    }
  }

  /**
   * Increase performance quality
   */
  private increaseQuality(current: PerformanceQuality): PerformanceQuality {
    switch (current) {
      case PerformanceQuality.LOW:
        return PerformanceQuality.MEDIUM;
      case PerformanceQuality.MEDIUM:
        return PerformanceQuality.HIGH;
      case PerformanceQuality.HIGH:
        return PerformanceQuality.ULTRA;
      case PerformanceQuality.ULTRA:
        return PerformanceQuality.ULTRA; // Already at highest
      default:
        return current;
    }
  }

  /**
   * Get memory usage (approximate)
   */
  private getMemoryUsage(): number {
    // React Native doesn't have direct memory access
    // This is an approximation based on metrics history size
    return this.metricsHistory.length * 0.1; // Very rough estimate
  }

  /**
   * Measure interaction delay
   */
  private measureInteractionDelay(): number {
    return new Promise<number>(resolve => {
      const start = performance.now();
      InteractionManager.runAfterInteractions(() => {
        const delay = performance.now() - start;
        resolve(delay);
      });
    }) as any; // Simplified for synchronous use
  }
}

/**
 * Singleton performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook for React components to use performance monitoring
 */
export function usePerformanceMonitor() {
  return {
    monitor: performanceMonitor,
    startFrame: () => performanceMonitor.startFrame(),
    endFrame: () => performanceMonitor.endFrame(),
    getCurrentMetrics: () => performanceMonitor.getCurrentMetrics(),
    getCurrentQuality: () => performanceMonitor.getCurrentQuality(),
    getQualitySettings: () => performanceMonitor.getQualitySettings(),
  };
}
