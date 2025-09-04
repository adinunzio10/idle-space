/**
 * Animation Performance Optimizer
 * 
 * Analyzes and optimizes React Native Reanimated worklet performance,
 * identifying JavaScript bridge crossings, UI thread blocking operations,
 * and inefficient shared value updates for smooth 60fps animations.
 */

import { 
  SharedValue, 
  runOnJS, 
  runOnUI, 
  measure,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

/**
 * Animation performance metrics
 */
export interface AnimationMetrics {
  id: string;
  name: string;
  workletExecutionTime: number; // ms
  bridgeCrossings: number;
  frameDrops: number;
  averageFPS: number;
  startTime: number;
  endTime?: number;
  duration: number;
  isRunning: boolean;
  optimizationSuggestions: string[];
}

/**
 * Worklet performance issue
 */
export interface WorkletPerformanceIssue {
  id: string;
  type: 'bridge-crossing' | 'heavy-computation' | 'memory-allocation' | 'sync-operation' | 'layout-thrashing';
  animationName: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  suggestedFix: string;
  codeExample: string;
  detectedAt: number;
  workletName?: string;
  executionTime?: number;
  bridgeCrossings?: number;
}

/**
 * Animation configuration for optimization
 */
interface OptimizedAnimationConfig {
  name: string;
  duration: number;
  easing: (value: number) => number;
  useNativeDriver: boolean;
  enableBatching: boolean;
  maxFrameSkip: number;
  priority: 'low' | 'normal' | 'high';
}

/**
 * Worklet execution context
 */
interface WorkletContext {
  name: string;
  startTime: number;
  bridgeCrossings: number;
  computationTime: number;
  memoryAllocations: number;
}

/**
 * Animation Performance Optimizer Class
 */
export class AnimationPerformanceOptimizer {
  private isOptimizing = false;
  private optimizationStartTime = 0;
  private animationMetrics = new Map<string, AnimationMetrics>();
  private detectedIssues: WorkletPerformanceIssue[] = [];
  private workletContexts = new Map<string, WorkletContext>();
  
  // Performance thresholds
  private readonly WORKLET_EXECUTION_THRESHOLD = 16.67; // 60fps budget
  private readonly BRIDGE_CROSSING_THRESHOLD = 2;
  private readonly FRAME_DROP_THRESHOLD = 5; // 5% frame drops
  private readonly HEAVY_COMPUTATION_THRESHOLD = 5; // 5ms
  
  // Optimization configurations
  private optimizedConfigs = new Map<string, OptimizedAnimationConfig>();
  
  // Frame monitoring
  private frameMonitor?: NodeJS.Timeout;
  private lastFrameTime = 0;
  private frameDropCount = 0;
  private totalFrames = 0;

  constructor() {
    this.setupDefaultOptimizations();
  }

  /**
   * Start animation performance optimization
   */
  startOptimization(): void {
    if (this.isOptimizing) {
      console.warn('[AnimationPerformanceOptimizer] Already optimizing');
      return;
    }

    console.log('[AnimationPerformanceOptimizer] Starting animation performance optimization');
    this.isOptimizing = true;
    this.optimizationStartTime = Date.now();
    
    // Clear previous data
    this.animationMetrics.clear();
    this.detectedIssues = [];
    this.workletContexts.clear();
    
    // Start frame monitoring
    this.startFrameMonitoring();
    
    // Start performance analysis
    this.startPerformanceAnalysis();
  }

  /**
   * Stop optimization and generate report
   */
  stopOptimization(): {
    animationMetrics: AnimationMetrics[];
    workletIssues: WorkletPerformanceIssue[];
    optimizationSummary: {
      totalAnimations: number;
      problematicAnimations: number;
      averageFPS: number;
      totalBridgeCrossings: number;
      criticalIssues: number;
    };
    recommendations: string[];
    optimizedConfigs: OptimizedAnimationConfig[];
  } {
    if (!this.isOptimizing) {
      throw new Error('Optimization is not running');
    }

    console.log('[AnimationPerformanceOptimizer] Stopping optimization and generating report');
    this.isOptimizing = false;
    
    // Stop monitoring
    this.stopFrameMonitoring();
    
    // Generate final analysis
    this.performFinalAnalysis();
    
    const animationMetrics = Array.from(this.animationMetrics.values());
    const optimizationSummary = this.generateOptimizationSummary();
    const recommendations = this.generateRecommendations();
    const optimizedConfigs = Array.from(this.optimizedConfigs.values());
    
    console.log('[AnimationPerformanceOptimizer] Optimization complete:', optimizationSummary);
    
    return {
      animationMetrics,
      workletIssues: this.detectedIssues,
      optimizationSummary,
      recommendations,
      optimizedConfigs,
    };
  }

  /**
   * Track animation start
   */
  startAnimationTracking(animationName: string): string {
    if (!this.isOptimizing) return '';

    const animationId = this.generateId();
    const metrics: AnimationMetrics = {
      id: animationId,
      name: animationName,
      workletExecutionTime: 0,
      bridgeCrossings: 0,
      frameDrops: 0,
      averageFPS: 60,
      startTime: Date.now(),
      duration: 0,
      isRunning: true,
      optimizationSuggestions: [],
    };

    this.animationMetrics.set(animationId, metrics);
    return animationId;
  }

  /**
   * Track animation end
   */
  endAnimationTracking(animationId: string): void {
    if (!this.isOptimizing) return;

    const metrics = this.animationMetrics.get(animationId);
    if (metrics) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.isRunning = false;
      
      // Analyze completed animation
      this.analyzeCompletedAnimation(metrics);
    }
  }

  /**
   * Track worklet execution
   */
  trackWorkletExecution(
    workletName: string,
    executionTime: number,
    bridgeCrossings: number = 0
  ): void {
    if (!this.isOptimizing) return;

    const context = this.workletContexts.get(workletName) || {
      name: workletName,
      startTime: Date.now(),
      bridgeCrossings: 0,
      computationTime: 0,
      memoryAllocations: 0,
    };

    context.computationTime += executionTime;
    context.bridgeCrossings += bridgeCrossings;
    this.workletContexts.set(workletName, context);

    // Check for immediate issues
    if (executionTime > this.WORKLET_EXECUTION_THRESHOLD) {
      this.addPerformanceIssue({
        type: 'heavy-computation',
        animationName: workletName,
        description: `Worklet execution time (${executionTime.toFixed(2)}ms) exceeds frame budget`,
        severity: 'high',
        impact: 'May cause frame drops and janky animations',
        suggestedFix: 'Optimize worklet computation or split across multiple frames',
        codeExample: this.generateWorkletOptimizationExample(workletName),
        workletName,
        executionTime,
      });
    }

    if (bridgeCrossings > this.BRIDGE_CROSSING_THRESHOLD) {
      this.addPerformanceIssue({
        type: 'bridge-crossing',
        animationName: workletName,
        description: `Excessive bridge crossings (${bridgeCrossings}) in worklet`,
        severity: 'critical',
        impact: 'Bridge crossings block the UI thread and cause performance issues',
        suggestedFix: 'Minimize runOnJS calls and keep logic in worklet',
        codeExample: this.generateBridgeCrossingFix(workletName),
        workletName,
        bridgeCrossings,
      });
    }
  }

  /**
   * Create optimized animation configuration
   */
  createOptimizedConfig(
    name: string,
    baseConfig: Partial<OptimizedAnimationConfig>
  ): OptimizedAnimationConfig {
    const defaultConfig: OptimizedAnimationConfig = {
      name,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      enableBatching: true,
      maxFrameSkip: 2,
      priority: 'normal',
    };

    const optimizedConfig = { ...defaultConfig, ...baseConfig };
    this.optimizedConfigs.set(name, optimizedConfig);
    return optimizedConfig;
  }

  /**
   * Create optimized timing animation
   */
  createOptimizedTiming(
    value: SharedValue<number>,
    toValue: number,
    config?: Partial<OptimizedAnimationConfig>
  ) {
    const animationConfig = this.createOptimizedConfig('timing', config || {});
    
    return withTiming(toValue, {
      duration: animationConfig.duration,
      easing: animationConfig.easing,
    });
  }

  /**
   * Create optimized spring animation
   */
  createOptimizedSpring(
    value: SharedValue<number>,
    toValue: number,
    config?: {
      damping?: number;
      stiffness?: number;
      mass?: number;
      velocity?: number;
    }
  ) {
    const springConfig = {
      damping: 15,
      stiffness: 200,
      mass: 1,
      velocity: 0,
      ...config,
    };
    
    return withSpring(toValue, springConfig);
  }

  /**
   * Create performance-optimized worklet
   */
  createOptimizedWorklet<T extends any[], R>(
    workletName: string,
    workletFn: (...args: T) => R,
    options: {
      enableProfiling?: boolean;
      maxExecutionTime?: number;
      enableBatching?: boolean;
    } = {}
  ): (...args: T) => R {
    const { 
      enableProfiling = true, 
      maxExecutionTime = this.WORKLET_EXECUTION_THRESHOLD,
      enableBatching = false 
    } = options;

    return (...args: T): R => {
      'worklet';
      
      if (enableProfiling && this.isOptimizing) {
        const startTime = performance.now();
        let bridgeCrossings = 0;
        
        // Wrap runOnJS calls to count bridge crossings
        const originalRunOnJS = runOnJS;
        (global as any).runOnJS = (fn: any) => {
          bridgeCrossings++;
          return originalRunOnJS(fn);
        };
        
        try {
          const result = workletFn(...args);
          const executionTime = performance.now() - startTime;
          
          // Track performance (need to use runOnJS to call class method)
          runOnJS((name: string, time: number, crossings: number) => {
            this.trackWorkletExecution(name, time, crossings);
          })(workletName, executionTime, bridgeCrossings);
          
          return result;
        } finally {
          // Restore original runOnJS
          (global as any).runOnJS = originalRunOnJS;
        }
      } else {
        return workletFn(...args);
      }
    };
  }

  /**
   * Batch multiple animations for better performance
   */
  batchAnimations(animations: (() => void)[]): void {
    'worklet';
    
    // Execute all animations in a single frame
    animations.forEach(animation => animation());
  }

  /**
   * Setup default optimization configurations
   */
  private setupDefaultOptimizations(): void {
    // Galaxy map pan/zoom optimizations
    this.createOptimizedConfig('galaxyPan', {
      duration: 0, // Gesture-driven
      easing: Easing.linear,
      useNativeDriver: true,
      enableBatching: true,
      priority: 'high',
    });

    this.createOptimizedConfig('galaxyZoom', {
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      enableBatching: true,
      priority: 'high',
    });

    // Beacon animations
    this.createOptimizedConfig('beaconPlacement', {
      duration: 250,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
      enableBatching: false,
      priority: 'normal',
    });

    // Pattern animations
    this.createOptimizedConfig('patternHighlight', {
      duration: 500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
      enableBatching: true,
      priority: 'normal',
    });
  }

  /**
   * Start frame monitoring
   */
  private startFrameMonitoring(): void {
    this.lastFrameTime = performance.now();
    this.frameDropCount = 0;
    this.totalFrames = 0;

    this.frameMonitor = setInterval(() => {
      if (!this.isOptimizing) return;

      const now = performance.now();
      const frameTime = now - this.lastFrameTime;
      this.lastFrameTime = now;
      this.totalFrames++;

      // Check for frame drops (>16.67ms for 60fps)
      if (frameTime > 16.67) {
        this.frameDropCount++;
      }

      // Update animation metrics
      this.updateAnimationFPS();
    }, 16.67); // 60fps monitoring
  }

  /**
   * Stop frame monitoring
   */
  private stopFrameMonitoring(): void {
    if (this.frameMonitor) {
      clearInterval(this.frameMonitor);
      this.frameMonitor = undefined;
    }
  }

  /**
   * Update animation FPS metrics
   */
  private updateAnimationFPS(): void {
    const frameDropRate = this.totalFrames > 0 ? this.frameDropCount / this.totalFrames : 0;
    const currentFPS = Math.max(0, 60 * (1 - frameDropRate));

    for (const [id, metrics] of this.animationMetrics) {
      if (metrics.isRunning) {
        metrics.averageFPS = currentFPS;
        metrics.frameDrops = this.frameDropCount;

        if (frameDropRate > this.FRAME_DROP_THRESHOLD / 100) {
          metrics.optimizationSuggestions.push('High frame drop rate detected');
        }
      }
    }
  }

  /**
   * Start performance analysis
   */
  private startPerformanceAnalysis(): void {
    const analysisInterval = setInterval(() => {
      if (!this.isOptimizing) {
        clearInterval(analysisInterval);
        return;
      }

      // Periodic analysis of animation performance
      this.analyzeCurrentPerformance();
    }, 2000); // Every 2 seconds
  }

  /**
   * Analyze current performance
   */
  private analyzeCurrentPerformance(): void {
    const runningAnimations = Array.from(this.animationMetrics.values())
      .filter(metrics => metrics.isRunning);

    if (runningAnimations.length > 5) {
      this.addPerformanceIssue({
        type: 'memory-allocation',
        animationName: 'Multiple',
        description: `${runningAnimations.length} animations running simultaneously`,
        severity: 'medium',
        impact: 'Multiple concurrent animations may degrade performance',
        suggestedFix: 'Limit concurrent animations or use animation batching',
        codeExample: this.generateAnimationBatchingExample(),
      });
    }

    // Check worklet performance
    for (const [name, context] of this.workletContexts) {
      if (context.computationTime > 100) { // 100ms total
        this.addPerformanceIssue({
          type: 'heavy-computation',
          animationName: name,
          description: `Worklet ${name} has accumulated ${context.computationTime.toFixed(2)}ms computation time`,
          severity: 'high',
          impact: 'Heavy computation in worklets can cause UI thread blocking',
          suggestedFix: 'Optimize worklet logic or move computation to JS thread',
          codeExample: this.generateWorkletOptimizationExample(name),
          workletName: name,
          executionTime: context.computationTime,
        });
      }
    }
  }

  /**
   * Analyze completed animation
   */
  private analyzeCompletedAnimation(metrics: AnimationMetrics): void {
    // Check for performance issues
    if (metrics.averageFPS < 45) {
      metrics.optimizationSuggestions.push('Low FPS detected - consider optimization');
    }

    if (metrics.bridgeCrossings > 5) {
      metrics.optimizationSuggestions.push('Excessive bridge crossings - minimize runOnJS calls');
    }

    if (metrics.workletExecutionTime > this.WORKLET_EXECUTION_THRESHOLD * 10) {
      metrics.optimizationSuggestions.push('High worklet execution time - optimize computation');
    }
  }

  /**
   * Perform final analysis
   */
  private performFinalAnalysis(): void {
    // Analyze overall performance patterns
    const allMetrics = Array.from(this.animationMetrics.values());
    const averageFPS = allMetrics.reduce((sum, m) => sum + m.averageFPS, 0) / allMetrics.length;
    
    if (averageFPS < 50) {
      this.addPerformanceIssue({
        type: 'sync-operation',
        animationName: 'Global',
        description: `Overall average FPS (${averageFPS.toFixed(1)}) is below optimal`,
        severity: 'high',
        impact: 'Poor animation performance affects user experience',
        suggestedFix: 'Review and optimize animation configurations',
        codeExample: this.generateGlobalOptimizationExample(),
      });
    }

    // Sort issues by severity
    this.detectedIssues.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Generate optimization summary
   */
  private generateOptimizationSummary() {
    const allMetrics = Array.from(this.animationMetrics.values());
    const totalBridgeCrossings = Array.from(this.workletContexts.values())
      .reduce((sum, ctx) => sum + ctx.bridgeCrossings, 0);
    
    return {
      totalAnimations: allMetrics.length,
      problematicAnimations: allMetrics.filter(m => 
        m.averageFPS < 50 || m.frameDrops > 10 || m.optimizationSuggestions.length > 0
      ).length,
      averageFPS: allMetrics.length > 0 ? 
        allMetrics.reduce((sum, m) => sum + m.averageFPS, 0) / allMetrics.length : 60,
      totalBridgeCrossings,
      criticalIssues: this.detectedIssues.filter(i => i.severity === 'critical').length,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = this.detectedIssues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`Address ${criticalIssues.length} critical animation issues immediately`);
    }
    
    const bridgeIssues = this.detectedIssues.filter(i => i.type === 'bridge-crossing');
    if (bridgeIssues.length > 0) {
      recommendations.push('Minimize JavaScript bridge crossings in worklets');
    }
    
    const heavyComputation = this.detectedIssues.filter(i => i.type === 'heavy-computation');
    if (heavyComputation.length > 0) {
      recommendations.push('Optimize heavy computations in animation worklets');
    }
    
    if (this.frameDropCount / this.totalFrames > 0.1) {
      recommendations.push('High frame drop rate detected - review animation complexity');
    }
    
    return recommendations;
  }

  /**
   * Add performance issue
   */
  private addPerformanceIssue(issue: Omit<WorkletPerformanceIssue, 'id' | 'detectedAt'>): void {
    const newIssue: WorkletPerformanceIssue = {
      ...issue,
      id: this.generateId(),
      detectedAt: Date.now(),
    };
    this.detectedIssues.push(newIssue);
  }

  /**
   * Generate code examples for fixes
   */
  private generateWorkletOptimizationExample(workletName: string): string {
    return `
// Before: Heavy computation in worklet
const ${workletName} = () => {
  'worklet';
  
  // Heavy computation on UI thread
  let result = 0;
  for (let i = 0; i < 10000; i++) {
    result += Math.sqrt(i * Math.PI);
  }
  
  return result;
};

// After: Optimized worklet
const ${workletName} = () => {
  'worklet';
  
  // Use cached/precomputed values
  return cachedExpensiveComputation.value;
};

// Or move heavy computation to JS thread
const ${workletName} = () => {
  'worklet';
  
  runOnJS(computeExpensiveValue)();
  return lightweightComputation();
};`;
  }

  private generateBridgeCrossingFix(workletName: string): string {
    return `
// Before: Multiple bridge crossings
const ${workletName} = (values) => {
  'worklet';
  
  values.forEach(value => {
    runOnJS(processValue)(value); // Bridge crossing for each value
  });
};

// After: Batched bridge crossing
const ${workletName} = (values) => {
  'worklet';
  
  // Process all values in single bridge crossing
  runOnJS(processAllValues)(values);
};

// Or keep logic in worklet
const ${workletName} = (values) => {
  'worklet';
  
  // Process in worklet without bridge crossings
  return values.map(value => processValueInWorklet(value));
};`;
  }

  private generateAnimationBatchingExample(): string {
    return `
// Before: Individual animations
values.forEach(value => {
  value.value = withTiming(newValue);
});

// After: Batched animations
const batchedAnimations = values.map(value => () => {
  value.value = withTiming(newValue);
});

// Execute in single frame
batchAnimations(batchedAnimations);`;
  }

  private generateGlobalOptimizationExample(): string {
    return `
// Optimize animation configurations
const optimizedConfig = {
  duration: 250, // Shorter durations
  easing: Easing.out(Easing.cubic), // Efficient easing
  useNativeDriver: true, // Always use native driver
};

// Use animation priorities
const highPriorityAnimations = withTiming(value, {
  ...optimizedConfig,
  reduceMotion: ReanimatedReduceMotion.Never,
});

// Implement animation pooling for frequent animations
const animationPool = new ObjectPool(() => 
  withTiming(0, optimizedConfig)
);`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Singleton animation performance optimizer
 */
export const animationPerformanceOptimizer = new AnimationPerformanceOptimizer();

/**
 * Hook for animation performance optimization
 */
export function useAnimationPerformanceOptimization() {
  return {
    optimizer: animationPerformanceOptimizer,
    startOptimization: () => animationPerformanceOptimizer.startOptimization(),
    stopOptimization: () => animationPerformanceOptimizer.stopOptimization(),
    createOptimizedTiming: (value: SharedValue<number>, toValue: number, config?: any) =>
      animationPerformanceOptimizer.createOptimizedTiming(value, toValue, config),
    createOptimizedSpring: (value: SharedValue<number>, toValue: number, config?: any) =>
      animationPerformanceOptimizer.createOptimizedSpring(value, toValue, config),
    createOptimizedWorklet: <T extends any[], R>(name: string, fn: (...args: T) => R, options?: any) =>
      animationPerformanceOptimizer.createOptimizedWorklet(name, fn, options),
  };
}