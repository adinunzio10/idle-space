import { InteractionManager } from 'react-native';

// React import for the hook
import * as React from 'react';

/**
 * FPS monitoring specifically for React Native applications
 * Uses requestAnimationFrame and InteractionManager for accurate measurements
 */
export class FPSMonitor {
  private frameCount: number = 0;
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private frameTimes: number[] = [];
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private callbacks: ((fps: number, frameTime: number) => void)[] = [];
  private updateInterval: number = 1000; // Update every second
  private lastUpdateTime: number = 0;

  // Performance thresholds
  private readonly TARGET_FPS = 60;
  private readonly ACCEPTABLE_FPS = 45;
  private readonly POOR_FPS = 30;

  /**
   * Start FPS monitoring
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.frameCount = 0;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameTimes = [];
    this.scheduleFrame();
  }

  /**
   * Stop FPS monitoring
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Add callback for FPS updates
   */
  addCallback(callback: (fps: number, frameTime: number) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback
   */
  removeCallback(callback: (fps: number, frameTime: number) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Get current FPS
   */
  getCurrentFPS(): number {
    if (this.frameTimes.length === 0) return 0;

    const avgFrameTime =
      this.frameTimes.reduce((sum, time) => sum + time, 0) /
      this.frameTimes.length;
    return Math.min(this.TARGET_FPS, 1000 / avgFrameTime);
  }

  /**
   * Get performance quality based on current FPS
   */
  getPerformanceQuality(): 'excellent' | 'good' | 'poor' | 'critical' {
    const fps = this.getCurrentFPS();

    if (fps >= this.TARGET_FPS - 5) return 'excellent';
    if (fps >= this.ACCEPTABLE_FPS) return 'good';
    if (fps >= this.POOR_FPS) return 'poor';
    return 'critical';
  }

  /**
   * Get detailed performance metrics
   */
  getMetrics(): {
    currentFPS: number;
    avgFrameTime: number;
    frameDrops: number;
    quality: string;
    totalFrames: number;
    uptime: number;
  } {
    const now = performance.now();
    const uptime = now - this.startTime;
    const avgFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((sum, time) => sum + time, 0) /
          this.frameTimes.length
        : 0;

    // Calculate frame drops (frames that took longer than 16.67ms)
    const frameDrops = this.frameTimes.filter(time => time > 16.67).length;

    return {
      currentFPS: this.getCurrentFPS(),
      avgFrameTime,
      frameDrops,
      quality: this.getPerformanceQuality(),
      totalFrames: this.frameCount,
      uptime,
    };
  }

  /**
   * Set update interval for callbacks
   */
  setUpdateInterval(interval: number): void {
    this.updateInterval = interval;
  }

  /**
   * Check if FPS monitoring is currently active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Schedule next frame measurement
   */
  private scheduleFrame = (): void => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.measureFrame);
  };

  /**
   * Measure frame timing
   */
  private measureFrame = (timestamp: number): void => {
    if (!this.isRunning) return;

    const frameTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.frameCount++;

    // Store frame time for averaging
    this.frameTimes.push(frameTime);

    // Keep only the last 60 frames for moving average
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    // Update callbacks at specified interval
    if (timestamp - this.lastUpdateTime >= this.updateInterval) {
      this.notifyCallbacks();
      this.lastUpdateTime = timestamp;
    }

    this.scheduleFrame();
  };

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(): void {
    const fps = this.getCurrentFPS();
    const avgFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((sum, time) => sum + time, 0) /
          this.frameTimes.length
        : 0;

    this.callbacks.forEach(callback => {
      try {
        callback(fps, avgFrameTime);
      } catch (error) {
        console.warn('FPS callback error:', error);
      }
    });
  }
}

/**
 * React Native specific performance monitor
 * Includes interaction delays and JS thread monitoring
 */
export class ReactNativePerformanceMonitor extends FPSMonitor {
  private interactionDelays: number[] = [];
  private jsThreadBlocked: boolean = false;
  private lastInteractionTest: number = 0;
  private interactionTestInterval: number = 5000; // Test every 5 seconds

  constructor() {
    super();
    this.startInteractionMonitoring();
  }

  /**
   * Get extended metrics including RN-specific data
   */
  getExtendedMetrics(): {
    fps: number;
    avgFrameTime: number;
    frameDrops: number;
    quality: string;
    totalFrames: number;
    uptime: number;
    avgInteractionDelay: number;
    jsThreadBlocked: boolean;
    memoryWarning: boolean;
  } {
    const baseMetrics = this.getMetrics();
    const avgInteractionDelay =
      this.interactionDelays.length > 0
        ? this.interactionDelays.reduce((sum, delay) => sum + delay, 0) /
          this.interactionDelays.length
        : 0;

    return {
      fps: baseMetrics.currentFPS,
      avgFrameTime: baseMetrics.avgFrameTime,
      frameDrops: baseMetrics.frameDrops,
      quality: baseMetrics.quality,
      totalFrames: baseMetrics.totalFrames,
      uptime: baseMetrics.uptime,
      avgInteractionDelay,
      jsThreadBlocked: this.jsThreadBlocked,
      memoryWarning: this.checkMemoryPressure(),
    };
  }

  /**
   * Start monitoring interaction delays
   */
  private startInteractionMonitoring(): void {
    this.scheduleInteractionTest();
  }

  /**
   * Schedule next interaction delay test
   */
  private scheduleInteractionTest(): void {
    setTimeout(() => {
      if (!this.isActive()) return;

      this.testInteractionDelay();
      this.scheduleInteractionTest();
    }, this.interactionTestInterval);
  }

  /**
   * Test JS thread responsiveness
   */
  private testInteractionDelay(): void {
    const startTime = performance.now();

    InteractionManager.runAfterInteractions(() => {
      const delay = performance.now() - startTime;

      this.interactionDelays.push(delay);

      // Keep only last 10 measurements
      if (this.interactionDelays.length > 10) {
        this.interactionDelays.shift();
      }

      // Consider JS thread blocked if delay > 100ms
      this.jsThreadBlocked = delay > 100;

      this.lastInteractionTest = Date.now();
    });
  }

  /**
   * Check for memory pressure (simplified heuristic)
   */
  private checkMemoryPressure(): boolean {
    // In React Native, we don't have direct access to memory info
    // This is a simplified check based on performance degradation
    const fps = this.getCurrentFPS();
    const avgInteractionDelay =
      this.interactionDelays.length > 0
        ? this.interactionDelays.reduce((sum, delay) => sum + delay, 0) /
          this.interactionDelays.length
        : 0;

    // Heuristic: low FPS + high interaction delays might indicate memory pressure
    return fps < 30 && avgInteractionDelay > 200;
  }
}

/**
 * Global FPS monitor instance
 */
export const fpsMonitor = new ReactNativePerformanceMonitor();

/**
 * React hook for FPS monitoring
 */
export function useFPSMonitor() {
  const [metrics, setMetrics] = React.useState(() =>
    fpsMonitor.getExtendedMetrics()
  );

  React.useEffect(() => {
    const callback = () => {
      setMetrics(fpsMonitor.getExtendedMetrics());
    };

    fpsMonitor.addCallback(callback);
    fpsMonitor.start();

    return () => {
      fpsMonitor.removeCallback(callback);
    };
  }, []);

  return metrics;
}
