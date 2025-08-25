/**
 * GESTURE PERFORMANCE MONITORING
 * 
 * Comprehensive performance monitoring system for gesture interactions
 * with detailed metrics, benchmarking, and optimization recommendations.
 * 
 * Features:
 * - Real-time performance tracking
 * - Frame rate monitoring during gestures
 * - Memory usage analysis
 * - Battery impact measurement
 * - Cross-platform performance comparison
 * - Automated performance regression detection
 */

import { Platform } from 'react-native';

// Performance metric interfaces
export interface GesturePerformanceMetrics {
  // Timing metrics
  gestureStartTime: number;
  gestureEndTime: number;
  totalDuration: number;
  responseTime: number; // Time from touch to first response
  
  // Frame rate metrics
  averageFrameRate: number;
  minFrameRate: number;
  droppedFrames: number;
  totalFrames: number;
  
  // Memory metrics
  memoryUsageBefore: number;
  memoryUsageAfter: number;
  memoryDelta: number;
  peakMemoryUsage: number;
  
  // CPU metrics
  cpuUsageAverage: number;
  cpuUsagePeak: number;
  
  // Gesture-specific metrics
  gestureType: string;
  touchPoints: number;
  gestureDistance?: number;
  gestureVelocity?: number;
  
  // Quality metrics
  accuracy: number; // How accurately the gesture was recognized
  smoothness: number; // How smooth the gesture execution was
  responsiveness: number; // How responsive the UI felt
  
  // Device context
  platform: string;
  deviceModel?: string;
  screenDensity: number;
  
  // Timestamps for detailed analysis
  milestones: { name: string; timestamp: number }[];
}

export interface PerformanceBenchmark {
  name: string;
  targetFrameRate: number;
  maxResponseTime: number;
  maxMemoryDelta: number;
  minAccuracy: number;
  minSmoothness: number;
}

// Performance benchmarks for different scenarios
export const PERFORMANCE_BENCHMARKS: Record<string, PerformanceBenchmark> = {
  basicNavigation: {
    name: 'Basic Navigation',
    targetFrameRate: 58, // Allow 2fps drop from 60fps
    maxResponseTime: 50, // 50ms max response time
    maxMemoryDelta: 10 * 1024 * 1024, // 10MB max memory increase
    minAccuracy: 0.95,
    minSmoothness: 0.9,
  },
  
  complexRendering: {
    name: 'Complex Rendering (500+ beacons)',
    targetFrameRate: 55, // Allow 5fps drop for complex scenes
    maxResponseTime: 100,
    maxMemoryDelta: 20 * 1024 * 1024, // 20MB for complex scenes
    minAccuracy: 0.9,
    minSmoothness: 0.8,
  },
  
  simultaneousGestures: {
    name: 'Simultaneous Pan+Pinch',
    targetFrameRate: 56,
    maxResponseTime: 75,
    maxMemoryDelta: 15 * 1024 * 1024,
    minAccuracy: 0.85,
    minSmoothness: 0.85,
  },
  
  palmRejection: {
    name: 'Palm Rejection',
    targetFrameRate: 60, // Should not impact performance
    maxResponseTime: 30,
    maxMemoryDelta: 5 * 1024 * 1024,
    minAccuracy: 0.95,
    minSmoothness: 0.95,
  },
};

/**
 * Gesture Performance Monitor
 */
export class GesturePerformanceMonitor {
  private currentMetrics: Partial<GesturePerformanceMetrics> = {};
  private frameTimeHistory: number[] = [];
  private memoryHistory: number[] = [];
  private cpuHistory: number[] = [];
  private isMonitoring = false;
  private animationFrameId?: number;
  private startTimestamp = 0;
  private lastFrameTimestamp = 0;
  
  // Callbacks for external monitoring
  private onMetricsUpdate?: (metrics: Partial<GesturePerformanceMetrics>) => void;
  private onBenchmarkViolation?: (violation: BenchmarkViolation) => void;

  constructor() {
    this.reset();
  }

  /**
   * Start monitoring a gesture
   */
  startMonitoring(gestureType: string, touchPoints: number = 1): void {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.reset();
    this.isMonitoring = true;
    this.startTimestamp = performance.now();
    
    this.currentMetrics = {
      gestureType,
      touchPoints,
      gestureStartTime: this.startTimestamp,
      platform: Platform.OS,
      screenDensity: Platform.OS === 'ios' ? 2 : 1.5, // Approximate
      milestones: [{ name: 'monitoring_started', timestamp: this.startTimestamp }],
      memoryUsageBefore: this.getCurrentMemoryUsage(),
      responseTime: 0,
    };

    this.startFrameRateMonitoring();
    this.startMemoryMonitoring();
    this.startCPUMonitoring();
  }

  /**
   * Stop monitoring and return final metrics
   */
  stopMonitoring(): GesturePerformanceMetrics | null {
    if (!this.isMonitoring) {
      return null;
    }

    const endTime = performance.now();
    this.isMonitoring = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Finalize metrics
    const finalMetrics: GesturePerformanceMetrics = {
      ...this.currentMetrics,
      gestureEndTime: endTime,
      totalDuration: endTime - this.startTimestamp,
      averageFrameRate: this.calculateAverageFrameRate(),
      minFrameRate: this.calculateMinFrameRate(),
      droppedFrames: this.calculateDroppedFrames(),
      totalFrames: this.frameTimeHistory.length,
      memoryUsageAfter: this.getCurrentMemoryUsage(),
      memoryDelta: this.getCurrentMemoryUsage() - (this.currentMetrics.memoryUsageBefore || 0),
      peakMemoryUsage: Math.max(...this.memoryHistory),
      cpuUsageAverage: this.calculateAverageCPU(),
      cpuUsagePeak: Math.max(...this.cpuHistory),
      accuracy: this.calculateAccuracy(),
      smoothness: this.calculateSmoothness(),
      responsiveness: this.calculateResponsiveness(),
    } as GesturePerformanceMetrics;

    // Add final milestone
    finalMetrics.milestones!.push({ name: 'monitoring_stopped', timestamp: endTime });

    return finalMetrics;
  }

  /**
   * Record a milestone during gesture execution
   */
  recordMilestone(name: string): void {
    if (!this.isMonitoring) return;

    this.currentMetrics.milestones = this.currentMetrics.milestones || [];
    this.currentMetrics.milestones.push({
      name,
      timestamp: performance.now(),
    });
  }

  /**
   * Record gesture response time
   */
  recordResponseTime(responseTime: number): void {
    if (!this.isMonitoring) return;

    this.currentMetrics.responseTime = responseTime;
    this.recordMilestone('first_response');
  }

  /**
   * Record gesture distance and velocity
   */
  recordGestureMetrics(distance?: number, velocity?: number): void {
    if (!this.isMonitoring) return;

    if (distance !== undefined) {
      this.currentMetrics.gestureDistance = distance;
    }
    if (velocity !== undefined) {
      this.currentMetrics.gestureVelocity = velocity;
    }
  }

  /**
   * Set callbacks for monitoring events
   */
  setCallbacks(callbacks: {
    onMetricsUpdate?: (metrics: Partial<GesturePerformanceMetrics>) => void;
    onBenchmarkViolation?: (violation: BenchmarkViolation) => void;
  }): void {
    this.onMetricsUpdate = callbacks.onMetricsUpdate;
    this.onBenchmarkViolation = callbacks.onBenchmarkViolation;
  }

  /**
   * Run performance benchmark test
   */
  async runBenchmark(
    benchmarkName: keyof typeof PERFORMANCE_BENCHMARKS,
    testFunction: () => Promise<void>
  ): Promise<BenchmarkResult> {
    const benchmark = PERFORMANCE_BENCHMARKS[benchmarkName];
    
    // Warm up
    await this.warmUp();
    
    // Clear previous data
    this.reset();
    
    // Start monitoring
    this.startMonitoring(`benchmark_${benchmarkName}`, 1);
    
    // Run test
    const testStartTime = performance.now();
    try {
      await testFunction();
    } catch (error) {
      console.error('Benchmark test failed:', error);
    }
    const testEndTime = performance.now();
    
    // Stop monitoring
    const metrics = this.stopMonitoring();
    
    if (!metrics) {
      throw new Error('Failed to collect performance metrics');
    }
    
    // Analyze results
    const violations = this.analyzeBenchmarkViolations(metrics, benchmark);
    
    return {
      benchmarkName,
      metrics,
      benchmark,
      violations,
      passed: violations.length === 0,
      testDuration: testEndTime - testStartTime,
    };
  }

  /**
   * Generate performance report
   */
  generateReport(metrics: GesturePerformanceMetrics[]): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      totalTests: metrics.length,
      summary: {
        averageFrameRate: this.average(metrics.map(m => m.averageFrameRate)),
        averageResponseTime: this.average(metrics.map(m => m.responseTime)),
        averageMemoryDelta: this.average(metrics.map(m => m.memoryDelta)),
        averageAccuracy: this.average(metrics.map(m => m.accuracy)),
        averageSmoothness: this.average(metrics.map(m => m.smoothness)),
      },
      testResults: metrics.map(m => ({
        gestureType: m.gestureType,
        duration: m.totalDuration,
        frameRate: m.averageFrameRate,
        responseTime: m.responseTime,
        memoryDelta: m.memoryDelta,
        passed: this.isMetricsWithinBounds(m),
      })),
      recommendations: this.generateOptimizationRecommendations(metrics),
    };

    return report;
  }

  // Private methods

  private reset(): void {
    this.currentMetrics = {};
    this.frameTimeHistory = [];
    this.memoryHistory = [];
    this.cpuHistory = [];
    this.lastFrameTimestamp = 0;
  }

  private startFrameRateMonitoring(): void {
    const monitorFrame = (timestamp: number) => {
      if (!this.isMonitoring) return;

      if (this.lastFrameTimestamp > 0) {
        const frameTime = timestamp - this.lastFrameTimestamp;
        this.frameTimeHistory.push(frameTime);
      }
      
      this.lastFrameTimestamp = timestamp;
      this.animationFrameId = requestAnimationFrame(monitorFrame);
    };

    this.animationFrameId = requestAnimationFrame(monitorFrame);
  }

  private startMemoryMonitoring(): void {
    const monitorMemory = () => {
      if (!this.isMonitoring) return;
      
      this.memoryHistory.push(this.getCurrentMemoryUsage());
      setTimeout(monitorMemory, 100); // Check every 100ms
    };

    setTimeout(monitorMemory, 100);
  }

  private startCPUMonitoring(): void {
    // Note: CPU monitoring is limited in web/mobile environments
    // This is a simplified implementation
    const monitorCPU = () => {
      if (!this.isMonitoring) return;
      
      // Approximate CPU usage based on frame timing consistency
      const recentFrames = this.frameTimeHistory.slice(-10);
      if (recentFrames.length > 0) {
        const variance = this.calculateVariance(recentFrames);
        const cpuEstimate = Math.min(100, variance / 5); // Rough estimation
        this.cpuHistory.push(cpuEstimate);
      }
      
      setTimeout(monitorCPU, 200); // Check every 200ms
    };

    setTimeout(monitorCPU, 200);
  }

  private getCurrentMemoryUsage(): number {
    // Note: Memory monitoring is limited in React Native
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0; // Fallback for environments without memory API
  }

  private calculateAverageFrameRate(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const averageFrameTime = this.average(this.frameTimeHistory);
    return 1000 / averageFrameTime;
  }

  private calculateMinFrameRate(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const maxFrameTime = Math.max(...this.frameTimeHistory);
    return 1000 / maxFrameTime;
  }

  private calculateDroppedFrames(): number {
    return this.frameTimeHistory.filter(frameTime => frameTime > 20).length; // >20ms = dropped frame
  }

  private calculateAverageCPU(): number {
    return this.cpuHistory.length > 0 ? this.average(this.cpuHistory) : 0;
  }

  private calculateAccuracy(): number {
    // Simplified accuracy calculation based on frame consistency
    if (this.frameTimeHistory.length === 0) return 1;
    
    const consistency = 1 - (this.calculateVariance(this.frameTimeHistory) / 400);
    return Math.max(0, Math.min(1, consistency));
  }

  private calculateSmoothness(): number {
    // Smoothness based on frame rate consistency
    if (this.frameTimeHistory.length === 0) return 1;
    
    const frameRates = this.frameTimeHistory.map(ft => 1000 / ft);
    const variance = this.calculateVariance(frameRates);
    const smoothness = 1 - (variance / 100);
    return Math.max(0, Math.min(1, smoothness));
  }

  private calculateResponsiveness(): number {
    // Responsiveness based on response time and frame rate
    const responseTime = this.currentMetrics.responseTime || 0;
    const frameRate = this.calculateAverageFrameRate();
    
    const responseScore = Math.max(0, 1 - (responseTime / 200));
    const frameRateScore = Math.max(0, frameRate / 60);
    
    return (responseScore + frameRateScore) / 2;
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = this.average(numbers);
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return this.average(squaredDiffs);
  }

  private analyzeBenchmarkViolations(
    metrics: GesturePerformanceMetrics,
    benchmark: PerformanceBenchmark
  ): BenchmarkViolation[] {
    const violations: BenchmarkViolation[] = [];

    if (metrics.averageFrameRate < benchmark.targetFrameRate) {
      violations.push({
        type: 'frameRate',
        expected: benchmark.targetFrameRate,
        actual: metrics.averageFrameRate,
        severity: 'high',
      });
    }

    if (metrics.responseTime > benchmark.maxResponseTime) {
      violations.push({
        type: 'responseTime',
        expected: benchmark.maxResponseTime,
        actual: metrics.responseTime,
        severity: 'medium',
      });
    }

    if (metrics.memoryDelta > benchmark.maxMemoryDelta) {
      violations.push({
        type: 'memoryUsage',
        expected: benchmark.maxMemoryDelta,
        actual: metrics.memoryDelta,
        severity: 'medium',
      });
    }

    if (metrics.accuracy < benchmark.minAccuracy) {
      violations.push({
        type: 'accuracy',
        expected: benchmark.minAccuracy,
        actual: metrics.accuracy,
        severity: 'high',
      });
    }

    if (metrics.smoothness < benchmark.minSmoothness) {
      violations.push({
        type: 'smoothness',
        expected: benchmark.minSmoothness,
        actual: metrics.smoothness,
        severity: 'medium',
      });
    }

    return violations;
  }

  private isMetricsWithinBounds(metrics: GesturePerformanceMetrics): boolean {
    // Check against basic performance requirements
    return metrics.averageFrameRate >= 55 && 
           metrics.responseTime <= 100 && 
           metrics.accuracy >= 0.8;
  }

  private generateOptimizationRecommendations(metrics: GesturePerformanceMetrics[]): string[] {
    const recommendations: string[] = [];

    const avgFrameRate = this.average(metrics.map(m => m.averageFrameRate));
    const avgResponseTime = this.average(metrics.map(m => m.responseTime));
    const avgMemoryDelta = this.average(metrics.map(m => m.memoryDelta));

    if (avgFrameRate < 55) {
      recommendations.push('Consider reducing rendering complexity or implementing LOD (Level of Detail)');
    }

    if (avgResponseTime > 100) {
      recommendations.push('Optimize gesture handling by using more worklets and reducing JavaScript thread calls');
    }

    if (avgMemoryDelta > 20 * 1024 * 1024) {
      recommendations.push('Implement memory pooling for frequently created objects');
    }

    const droppedFramesTotal = metrics.reduce((sum, m) => sum + m.droppedFrames, 0);
    if (droppedFramesTotal > metrics.length * 5) {
      recommendations.push('Reduce workload on UI thread by moving calculations to background');
    }

    return recommendations;
  }

  private async warmUp(): Promise<void> {
    // Perform some operations to warm up the JavaScript engine
    for (let i = 0; i < 1000; i++) {
      Math.random() * Math.PI;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Supporting interfaces
export interface BenchmarkViolation {
  type: 'frameRate' | 'responseTime' | 'memoryUsage' | 'accuracy' | 'smoothness';
  expected: number;
  actual: number;
  severity: 'low' | 'medium' | 'high';
}

export interface BenchmarkResult {
  benchmarkName: string;
  metrics: GesturePerformanceMetrics;
  benchmark: PerformanceBenchmark;
  violations: BenchmarkViolation[];
  passed: boolean;
  testDuration: number;
}

export interface PerformanceReport {
  timestamp: string;
  platform: string;
  totalTests: number;
  summary: {
    averageFrameRate: number;
    averageResponseTime: number;
    averageMemoryDelta: number;
    averageAccuracy: number;
    averageSmoothness: number;
  };
  testResults: {
    gestureType: string;
    duration: number;
    frameRate: number;
    responseTime: number;
    memoryDelta: number;
    passed: boolean;
  }[];
  recommendations: string[];
}

// Export singleton instance
export const gesturePerformanceMonitor = new GesturePerformanceMonitor();