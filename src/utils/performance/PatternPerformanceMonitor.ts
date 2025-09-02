import { PatternType } from '../../types/galaxy';

export interface PerformanceMetrics {
  operationType: string;
  patternType?: PatternType;
  startTime: number;
  endTime: number;
  duration: number;
  beaconCount: number;
  suggestionsGenerated?: number;
  memoryUsage?: number;
  frameRate?: number;
}

export interface PerformanceThresholds {
  maxPatternCalculationTime: number; // ms
  maxSuggestionGenerationTime: number; // ms
  minFrameRate: number; // fps
  maxMemoryDelta: number; // MB
}

export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  operationsOverThreshold: number;
  frameRateViolations: number;
  memoryLeaks: number;
  recommendations: string[];
}

/**
 * Performance monitoring system for pattern-related operations
 */
export class PatternPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private activeOperations: Map<
    string,
    { startTime: number; startMemory: number }
  > = new Map();
  private thresholds: PerformanceThresholds;
  private maxStoredMetrics: number = 1000;
  private frameRateHistory: number[] = [];
  private lastFrameTime: number = 0;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = {
      maxPatternCalculationTime: 50, // 50ms target
      maxSuggestionGenerationTime: 100, // 100ms target
      minFrameRate: 55, // 55fps minimum (allowing buffer from 60fps)
      maxMemoryDelta: 10, // 10MB max increase per operation
      ...thresholds,
    };
  }

  /**
   * Start monitoring a pattern operation
   */
  startOperation(
    operationId: string,
    operationType: string,
    beaconCount: number,
    patternType?: PatternType
  ): void {
    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();

    this.activeOperations.set(operationId, { startTime, startMemory });

    // Update frame rate tracking
    this.updateFrameRate();
  }

  /**
   * End monitoring a pattern operation
   */
  endOperation(
    operationId: string,
    operationType: string,
    beaconCount: number,
    patternType?: PatternType,
    suggestionsGenerated?: number
  ): PerformanceMetrics | null {
    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) {
      console.warn(`No active operation found for ID: ${operationId}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - activeOp.startTime;
    const currentMemory = this.getCurrentMemoryUsage();
    const memoryUsage = currentMemory - activeOp.startMemory;
    const currentFrameRate = this.getCurrentFrameRate();

    const metrics: PerformanceMetrics = {
      operationType,
      patternType,
      startTime: activeOp.startTime,
      endTime,
      duration,
      beaconCount,
      suggestionsGenerated,
      memoryUsage,
      frameRate: currentFrameRate,
    };

    this.metrics.push(metrics);
    this.activeOperations.delete(operationId);

    // Keep only recent metrics to prevent memory bloat
    if (this.metrics.length > this.maxStoredMetrics) {
      this.metrics = this.metrics.slice(-this.maxStoredMetrics);
    }

    // Log performance warnings
    this.checkPerformanceWarnings(metrics);

    return metrics;
  }

  /**
   * Measure and record a synchronous operation
   */
  measureOperation<T>(
    operationType: string,
    operation: () => T,
    beaconCount: number,
    patternType?: PatternType
  ): { result: T; metrics: PerformanceMetrics } {
    const operationId = `sync_${Date.now()}_${Math.random()}`;
    this.startOperation(operationId, operationType, beaconCount, patternType);

    const result = operation();

    const metrics = this.endOperation(
      operationId,
      operationType,
      beaconCount,
      patternType
    );

    return { result, metrics: metrics! };
  }

  /**
   * Measure and record an async operation
   */
  async measureAsyncOperation<T>(
    operationType: string,
    operation: () => Promise<T>,
    beaconCount: number,
    patternType?: PatternType
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const operationId = `async_${Date.now()}_${Math.random()}`;
    this.startOperation(operationId, operationType, beaconCount, patternType);

    const result = await operation();

    const metrics = this.endOperation(
      operationId,
      operationType,
      beaconCount,
      patternType
    );

    return { result, metrics: metrics! };
  }

  /**
   * Get performance report for recent operations
   */
  getPerformanceReport(lastNOperations?: number): PerformanceReport {
    const relevantMetrics = lastNOperations
      ? this.metrics.slice(-lastNOperations)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        operationsOverThreshold: 0,
        frameRateViolations: 0,
        memoryLeaks: 0,
        recommendations: ['No operations recorded yet'],
      };
    }

    const durations = relevantMetrics.map(m => m.duration);
    const totalOperations = relevantMetrics.length;
    const averageDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const operationsOverThreshold = relevantMetrics.filter(
      m => m.duration > this.getThresholdForOperation(m.operationType)
    ).length;

    const frameRateViolations = relevantMetrics.filter(
      m =>
        m.frameRate !== undefined && m.frameRate < this.thresholds.minFrameRate
    ).length;

    const memoryLeaks = relevantMetrics.filter(
      m =>
        m.memoryUsage !== undefined &&
        m.memoryUsage > this.thresholds.maxMemoryDelta
    ).length;

    const recommendations = this.generateRecommendations(relevantMetrics);

    return {
      totalOperations,
      averageDuration,
      maxDuration,
      minDuration,
      operationsOverThreshold,
      frameRateViolations,
      memoryLeaks,
      recommendations,
    };
  }

  /**
   * Get metrics for a specific operation type
   */
  getMetricsForOperation(
    operationType: string,
    patternType?: PatternType
  ): PerformanceMetrics[] {
    return this.metrics.filter(m => {
      const matchesType = m.operationType === operationType;
      const matchesPattern = !patternType || m.patternType === patternType;
      return matchesType && matchesPattern;
    });
  }

  /**
   * Check if current performance is within acceptable bounds
   */
  isPerformanceAcceptable(): boolean {
    const recentMetrics = this.metrics.slice(-10); // Check last 10 operations

    if (recentMetrics.length === 0) return true;

    // Check if more than 30% of recent operations exceeded thresholds
    const exceededCount = recentMetrics.filter(
      m => m.duration > this.getThresholdForOperation(m.operationType)
    ).length;

    const exceedanceRate = exceededCount / recentMetrics.length;

    // Check frame rate
    const avgFrameRate = this.getCurrentFrameRate();
    const frameRateAcceptable = avgFrameRate >= this.thresholds.minFrameRate;

    return exceedanceRate <= 0.3 && frameRateAcceptable;
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.metrics = [];
    this.frameRateHistory = [];
    this.activeOperations.clear();
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Private helper methods
   */

  private getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      // @ts-ignore - performance.memory is available in some environments
      return (performance.memory?.usedJSHeapSize || 0) / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  private updateFrameRate(): void {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameDuration = now - this.lastFrameTime;
      const frameRate = 1000 / frameDuration;

      this.frameRateHistory.push(frameRate);
      if (this.frameRateHistory.length > 60) {
        // Keep last 60 frames (1 second at 60fps)
        this.frameRateHistory.shift();
      }
    }
    this.lastFrameTime = now;
  }

  private getCurrentFrameRate(): number {
    if (this.frameRateHistory.length === 0) return 60; // Assume good frame rate if no data

    return (
      this.frameRateHistory.reduce((sum, rate) => sum + rate, 0) /
      this.frameRateHistory.length
    );
  }

  private getThresholdForOperation(operationType: string): number {
    switch (operationType) {
      case 'pattern-calculation':
      case 'pattern-detection':
        return this.thresholds.maxPatternCalculationTime;
      case 'suggestion-generation':
      case 'pattern-suggestion':
        return this.thresholds.maxSuggestionGenerationTime;
      default:
        return this.thresholds.maxSuggestionGenerationTime;
    }
  }

  private checkPerformanceWarnings(metrics: PerformanceMetrics): void {
    const threshold = this.getThresholdForOperation(metrics.operationType);

    if (metrics.duration > threshold) {
      console.warn(
        `Pattern operation '${metrics.operationType}' took ${metrics.duration.toFixed(2)}ms ` +
          `(threshold: ${threshold}ms) with ${metrics.beaconCount} beacons`
      );
    }

    if (
      metrics.frameRate !== undefined &&
      metrics.frameRate < this.thresholds.minFrameRate
    ) {
      console.warn(
        `Frame rate dropped to ${metrics.frameRate.toFixed(1)}fps ` +
          `(minimum: ${this.thresholds.minFrameRate}fps) during ${metrics.operationType}`
      );
    }

    if (
      metrics.memoryUsage !== undefined &&
      metrics.memoryUsage > this.thresholds.maxMemoryDelta
    ) {
      console.warn(
        `Memory usage increased by ${metrics.memoryUsage.toFixed(2)}MB ` +
          `(threshold: ${this.thresholds.maxMemoryDelta}MB) during ${metrics.operationType}`
      );
    }
  }

  private generateRecommendations(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];

    if (metrics.length === 0) return recommendations;

    // Check average performance
    const avgDuration =
      metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    if (avgDuration > 100) {
      recommendations.push(
        'Consider reducing pattern calculation frequency or beacon count limits'
      );
    }

    // Check for frame rate issues
    const frameRateMetrics = metrics.filter(m => m.frameRate !== undefined);
    if (frameRateMetrics.length > 0) {
      const avgFrameRate =
        frameRateMetrics.reduce((sum, m) => sum + m.frameRate!, 0) /
        frameRateMetrics.length;
      if (avgFrameRate < this.thresholds.minFrameRate) {
        recommendations.push(
          'Frame rate is below target - consider implementing pattern caching or debouncing'
        );
      }
    }

    // Check for memory issues
    const memoryMetrics = metrics.filter(m => m.memoryUsage !== undefined);
    if (
      memoryMetrics.some(m => m.memoryUsage! > this.thresholds.maxMemoryDelta)
    ) {
      recommendations.push(
        'Memory usage spikes detected - review object creation and cleanup'
      );
    }

    // Pattern-specific recommendations
    const patternTypes = [
      ...new Set(metrics.map(m => m.patternType).filter(Boolean)),
    ];
    for (const patternType of patternTypes) {
      const patternMetrics = metrics.filter(m => m.patternType === patternType);
      const avgPatternDuration =
        patternMetrics.reduce((sum, m) => sum + m.duration, 0) /
        patternMetrics.length;

      if (avgPatternDuration > 75) {
        recommendations.push(
          `${patternType} pattern operations are slow - consider optimizing geometry calculations`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable bounds');
    }

    return recommendations;
  }
}

/**
 * Global pattern performance monitor instance
 */
export const patternPerformanceMonitor = new PatternPerformanceMonitor();
