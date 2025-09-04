/**
 * Memory Leak Detector
 * 
 * Advanced system for detecting memory leaks in React Native applications,
 * monitoring DOM nodes, event listeners, timers, and React component lifecycle issues.
 */

import React from 'react';
import { Platform } from 'react-native';

/**
 * Memory leak detection result
 */
export interface MemoryLeakSuspect {
  id: string;
  type: 'event-listener' | 'timer' | 'animation' | 'dom-node' | 'closure' | 'context' | 'observer' | 'ref';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: number;
  memoryImpact: number; // Estimated MB
  location?: string;
  stackTrace?: string;
  suggestedFix: string;
  component?: string;
  metadata: Record<string, any>;
}

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  timestamp: number;
  jsHeapSize: number;
  jsHeapUsed: number;
  domNodes?: number;
  eventListeners?: number;
  timers?: number;
  animationFrames?: number;
  observers?: number;
}

/**
 * Memory trend analysis
 */
export interface MemoryTrend {
  direction: 'increasing' | 'stable' | 'decreasing';
  rate: number; // MB per second
  confidence: number; // 0-1
  duration: number; // seconds
  snapshots: MemorySnapshot[];
}

/**
 * Event listener tracking
 */
interface EventListenerInfo {
  id: string;
  element: any;
  type: string;
  listener: Function;
  options?: any;
  addedAt: number;
  component?: string;
  stackTrace?: string;
}

/**
 * Timer tracking
 */
interface TimerInfo {
  id: number;
  type: 'timeout' | 'interval' | 'animation';
  callback: Function;
  delay?: number;
  createdAt: number;
  component?: string;
  stackTrace?: string;
}

/**
 * Observer tracking
 */
interface ObserverInfo {
  id: string;
  type: 'MutationObserver' | 'IntersectionObserver' | 'ResizeObserver' | 'PerformanceObserver';
  observer: any;
  createdAt: number;
  component?: string;
  isActive: boolean;
}

/**
 * React component lifecycle tracking
 */
interface ComponentLifecycleInfo {
  name: string;
  mountedAt: number;
  unmountedAt?: number;
  resources: {
    eventListeners: string[];
    timers: number[];
    observers: string[];
    refs: string[];
  };
}

/**
 * Memory Leak Detector Class
 */
export class MemoryLeakDetector {
  private isMonitoring = false;
  private monitoringStartTime = 0;
  private memorySnapshots: MemorySnapshot[] = [];
  private suspectedLeaks: MemoryLeakSuspect[] = [];
  
  // Resource tracking
  private trackedEventListeners = new Map<string, EventListenerInfo>();
  private trackedTimers = new Map<number, TimerInfo>();
  private trackedObservers = new Map<string, ObserverInfo>();
  private componentLifecycles = new Map<string, ComponentLifecycleInfo>();
  
  // Original functions for interception
  private originalAddEventListener?: any;
  private originalRemoveEventListener?: any;
  private originalSetTimeout?: any;
  private originalSetInterval?: any;
  private originalClearTimeout?: any;
  private originalClearInterval?: any;
  private originalRequestAnimationFrame?: any;
  private originalCancelAnimationFrame?: any;
  
  // Memory monitoring
  private memoryMonitorInterval?: NodeJS.Timeout;
  private readonly MEMORY_SAMPLE_INTERVAL = 2000; // 2 seconds
  private readonly MAX_SNAPSHOTS = 300; // 10 minutes at 2s intervals
  
  // Leak detection thresholds
  private readonly MEMORY_GROWTH_THRESHOLD = 5; // MB
  private readonly LISTENER_COUNT_THRESHOLD = 100;
  private readonly TIMER_COUNT_THRESHOLD = 50;
  private readonly DOM_NODE_GROWTH_THRESHOLD = 1000;

  constructor() {
    this.setupInterception();
  }

  /**
   * Start memory leak monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('[MemoryLeakDetector] Already monitoring');
      return;
    }

    console.log('[MemoryLeakDetector] Starting memory leak monitoring');
    this.isMonitoring = true;
    this.monitoringStartTime = Date.now();
    
    // Clear previous data
    this.memorySnapshots = [];
    this.suspectedLeaks = [];
    
    // Start memory sampling
    this.startMemoryMonitoring();
    
    // Enable resource tracking
    this.enableResourceTracking();
    
    // Start periodic leak analysis
    this.startPeriodicAnalysis();
  }

  /**
   * Stop monitoring and generate report
   */
  stopMonitoring(): {
    memoryLeaks: MemoryLeakSuspect[];
    memoryTrend: MemoryTrend;
    resourceSummary: {
      activeEventListeners: number;
      activeTimers: number;
      activeObservers: number;
      unmountedComponentsWithResources: number;
    };
    recommendations: string[];
  } {
    if (!this.isMonitoring) {
      throw new Error('Not currently monitoring');
    }

    console.log('[MemoryLeakDetector] Stopping monitoring and generating report');
    this.isMonitoring = false;
    
    // Stop monitoring
    this.stopMemoryMonitoring();
    this.disableResourceTracking();
    
    // Generate final analysis
    const finalAnalysis = this.performFinalAnalysis();
    const memoryTrend = this.analyzeMemoryTrend();
    const resourceSummary = this.generateResourceSummary();
    const recommendations = this.generateRecommendations();
    
    console.log('[MemoryLeakDetector] Monitoring complete:', {
      leaks: finalAnalysis.length,
      trend: memoryTrend.direction,
      resources: resourceSummary,
    });
    
    return {
      memoryLeaks: finalAnalysis,
      memoryTrend,
      resourceSummary,
      recommendations,
    };
  }

  /**
   * Track component mount
   */
  trackComponentMount(componentName: string): void {
    if (!this.isMonitoring) return;

    const lifecycle: ComponentLifecycleInfo = {
      name: componentName,
      mountedAt: Date.now(),
      resources: {
        eventListeners: [],
        timers: [],
        observers: [],
        refs: [],
      },
    };

    this.componentLifecycles.set(componentName, lifecycle);
  }

  /**
   * Track component unmount
   */
  trackComponentUnmount(componentName: string): void {
    if (!this.isMonitoring) return;

    const lifecycle = this.componentLifecycles.get(componentName);
    if (lifecycle) {
      lifecycle.unmountedAt = Date.now();
      
      // Check for resource leaks from unmounted component
      this.checkUnmountedComponentLeaks(lifecycle);
    }
  }

  /**
   * Track resource allocation
   */
  trackResourceAllocation(
    type: 'event-listener' | 'timer' | 'observer' | 'ref',
    resourceId: string,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.isMonitoring) return;

    if (component) {
      const lifecycle = this.componentLifecycles.get(component);
      if (lifecycle) {
        const resourceType = type === 'event-listener' ? 'eventListeners' :
                            type === 'timer' ? 'timers' :
                            type === 'observer' ? 'observers' : 'refs';
        
        lifecycle.resources[resourceType].push(resourceId);
      }
    }
  }

  /**
   * Track resource deallocation
   */
  trackResourceDeallocation(
    type: 'event-listener' | 'timer' | 'observer' | 'ref',
    resourceId: string,
    component?: string
  ): void {
    if (!this.isMonitoring) return;

    if (component) {
      const lifecycle = this.componentLifecycles.get(component);
      if (lifecycle) {
        const resourceType = type === 'event-listener' ? 'eventListeners' :
                            type === 'timer' ? 'timers' :
                            type === 'observer' ? 'observers' : 'refs';
        
        const index = lifecycle.resources[resourceType].indexOf(resourceId);
        if (index !== -1) {
          lifecycle.resources[resourceType].splice(index, 1);
        }
      }
    }
  }

  /**
   * Setup function interception for tracking
   */
  private setupInterception(): void {
    if (Platform.OS === 'web') {
      this.setupWebInterception();
    } else {
      this.setupNativeInterception();
    }
  }

  /**
   * Setup web-specific interception
   */
  private setupWebInterception(): void {
    if (typeof window === 'undefined') return;

    // Store original functions
    this.originalAddEventListener = EventTarget.prototype.addEventListener;
    this.originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    this.originalSetTimeout = window.setTimeout;
    this.originalSetInterval = window.setInterval;
    this.originalClearTimeout = window.clearTimeout;
    this.originalClearInterval = window.clearInterval;
    this.originalRequestAnimationFrame = window.requestAnimationFrame;
    this.originalCancelAnimationFrame = window.cancelAnimationFrame;
  }

  /**
   * Setup React Native interception
   */
  private setupNativeInterception(): void {
    // React Native specific interception
    this.originalSetTimeout = global.setTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearTimeout = global.clearTimeout;
    this.originalClearInterval = global.clearInterval;
    this.originalRequestAnimationFrame = global.requestAnimationFrame;
    this.originalCancelAnimationFrame = global.cancelAnimationFrame;
  }

  /**
   * Enable resource tracking by intercepting functions
   */
  private enableResourceTracking(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.enableWebResourceTracking();
    }
    this.enableTimerTracking();
  }

  /**
   * Enable web resource tracking
   */
  private enableWebResourceTracking(): void {
    const detector = this;
    
    // Intercept addEventListener
    EventTarget.prototype.addEventListener = function(
      this: EventTarget,
      type: string,
      listener: any,
      options?: any
    ) {
      const listenerId = detector.generateId();
      const stackTrace = detector.captureStackTrace();
      
      detector.trackedEventListeners.set(listenerId, {
        id: listenerId,
        element: this,
        type,
        listener,
        options,
        addedAt: Date.now(),
        stackTrace,
      });
      
      detector.trackResourceAllocation('event-listener', listenerId);
      
      return detector.originalAddEventListener!.call(this, type, listener, options);
    };

    // Intercept removeEventListener
    EventTarget.prototype.removeEventListener = function(
      this: EventTarget,
      type: string,
      listener: any,
      options?: any
    ) {
      // Find and remove from tracking
      for (const [id, info] of detector.trackedEventListeners) {
        if (info.element === this && info.type === type && info.listener === listener) {
          detector.trackedEventListeners.delete(id);
          detector.trackResourceDeallocation('event-listener', id);
          break;
        }
      }
      
      return detector.originalRemoveEventListener!.call(this, type, listener, options);
    };
  }

  /**
   * Enable timer tracking
   */
  private enableTimerTracking(): void {
    const detector = this;
    
    // Intercept setTimeout
    global.setTimeout = function(callback: Function, delay?: number, ...args: any[]): number {
      const timerId = detector.originalSetTimeout!(callback, delay, ...args);
      const stackTrace = detector.captureStackTrace();
      
      detector.trackedTimers.set(timerId, {
        id: timerId,
        type: 'timeout',
        callback,
        delay,
        createdAt: Date.now(),
        stackTrace,
      });
      
      detector.trackResourceAllocation('timer', timerId.toString());
      
      return timerId;
    };

    // Intercept setInterval
    global.setInterval = function(callback: Function, delay?: number, ...args: any[]): number {
      const timerId = detector.originalSetInterval!(callback, delay, ...args);
      const stackTrace = detector.captureStackTrace();
      
      detector.trackedTimers.set(timerId, {
        id: timerId,
        type: 'interval',
        callback,
        delay,
        createdAt: Date.now(),
        stackTrace,
      });
      
      detector.trackResourceAllocation('timer', timerId.toString());
      
      return timerId;
    };

    // Intercept clearTimeout
    global.clearTimeout = function(timerId?: number): void {
      if (timerId) {
        detector.trackedTimers.delete(timerId);
        detector.trackResourceDeallocation('timer', timerId.toString());
      }
      return detector.originalClearTimeout!(timerId);
    };

    // Intercept clearInterval
    global.clearInterval = function(timerId?: number): void {
      if (timerId) {
        detector.trackedTimers.delete(timerId);
        detector.trackResourceDeallocation('timer', timerId.toString());
      }
      return detector.originalClearInterval!(timerId);
    };

    // Intercept requestAnimationFrame
    global.requestAnimationFrame = function(callback: FrameRequestCallback): number {
      const animId = detector.originalRequestAnimationFrame!(callback);
      const stackTrace = detector.captureStackTrace();
      
      detector.trackedTimers.set(animId, {
        id: animId,
        type: 'animation',
        callback,
        createdAt: Date.now(),
        stackTrace,
      });
      
      return animId;
    };

    // Intercept cancelAnimationFrame
    global.cancelAnimationFrame = function(animId: number): void {
      detector.trackedTimers.delete(animId);
      return detector.originalCancelAnimationFrame!(animId);
    };
  }

  /**
   * Disable resource tracking and restore original functions
   */
  private disableResourceTracking(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Restore original functions
      EventTarget.prototype.addEventListener = this.originalAddEventListener!;
      EventTarget.prototype.removeEventListener = this.originalRemoveEventListener!;
    }

    global.setTimeout = this.originalSetTimeout!;
    global.setInterval = this.originalSetInterval!;
    global.clearTimeout = this.originalClearTimeout!;
    global.clearInterval = this.originalClearInterval!;
    global.requestAnimationFrame = this.originalRequestAnimationFrame!;
    global.cancelAnimationFrame = this.originalCancelAnimationFrame!;
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      const snapshot = this.takeMemorySnapshot();
      this.memorySnapshots.push(snapshot);
      
      // Keep only recent snapshots
      if (this.memorySnapshots.length > this.MAX_SNAPSHOTS) {
        this.memorySnapshots.shift();
      }
      
      // Analyze for immediate issues
      this.analyzeCurrentSnapshot(snapshot);
    }, this.MEMORY_SAMPLE_INTERVAL);
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = undefined;
    }
  }

  /**
   * Take a memory snapshot
   */
  private takeMemorySnapshot(): MemorySnapshot {
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      jsHeapSize: 0,
      jsHeapUsed: 0,
    };

    if (Platform.OS === 'web' && (performance as any).memory) {
      const memory = (performance as any).memory;
      snapshot.jsHeapSize = memory.totalJSHeapSize / (1024 * 1024); // Convert to MB
      snapshot.jsHeapUsed = memory.usedJSHeapSize / (1024 * 1024);
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      snapshot.domNodes = document.querySelectorAll('*').length;
    }

    snapshot.eventListeners = this.trackedEventListeners.size;
    snapshot.timers = this.trackedTimers.size;

    return snapshot;
  }

  /**
   * Analyze current snapshot for immediate issues
   */
  private analyzeCurrentSnapshot(snapshot: MemorySnapshot): void {
    // Check for excessive resource counts
    if (snapshot.eventListeners && snapshot.eventListeners > this.LISTENER_COUNT_THRESHOLD) {
      this.addSuspectedLeak({
        type: 'event-listener',
        description: `Excessive event listeners detected: ${snapshot.eventListeners}`,
        severity: 'high',
        memoryImpact: snapshot.eventListeners * 0.01, // Rough estimate
        suggestedFix: 'Review event listener cleanup in component unmount',
        metadata: { count: snapshot.eventListeners },
      });
    }

    if (snapshot.timers && snapshot.timers > this.TIMER_COUNT_THRESHOLD) {
      this.addSuspectedLeak({
        type: 'timer',
        description: `Excessive timers detected: ${snapshot.timers}`,
        severity: 'medium',
        memoryImpact: snapshot.timers * 0.001,
        suggestedFix: 'Clear timers in useEffect cleanup functions',
        metadata: { count: snapshot.timers },
      });
    }

    // Check memory growth
    if (this.memorySnapshots.length > 10) {
      const oldSnapshot = this.memorySnapshots[this.memorySnapshots.length - 10];
      const growthRate = (snapshot.jsHeapUsed - oldSnapshot.jsHeapUsed) / 10; // MB per sample

      if (growthRate > 0.5) { // More than 0.5MB per sample (2s interval)
        this.addSuspectedLeak({
          type: 'closure',
          description: `Rapid memory growth detected: ${(growthRate * 30).toFixed(1)}MB/min`,
          severity: 'critical',
          memoryImpact: growthRate * 30,
          suggestedFix: 'Check for memory leaks in closures and circular references',
          metadata: { growthRate },
        });
      }
    }
  }

  /**
   * Add suspected leak
   */
  private addSuspectedLeak(leak: Omit<MemoryLeakSuspect, 'id' | 'detectedAt'>): void {
    const suspectedLeak: MemoryLeakSuspect = {
      ...leak,
      id: this.generateId(),
      detectedAt: Date.now(),
    };

    this.suspectedLeaks.push(suspectedLeak);
  }

  /**
   * Check for leaks in unmounted components
   */
  private checkUnmountedComponentLeaks(lifecycle: ComponentLifecycleInfo): void {
    const leaks: string[] = [];

    // Check for remaining event listeners
    lifecycle.resources.eventListeners.forEach(listenerId => {
      if (this.trackedEventListeners.has(listenerId)) {
        leaks.push(`Event listener: ${listenerId}`);
      }
    });

    // Check for remaining timers
    lifecycle.resources.timers.forEach(timerId => {
      const timerIdNum = parseInt(timerId);
      if (this.trackedTimers.has(timerIdNum)) {
        leaks.push(`Timer: ${timerId}`);
      }
    });

    if (leaks.length > 0) {
      this.addSuspectedLeak({
        type: 'closure',
        description: `Component ${lifecycle.name} unmounted with ${leaks.length} active resources`,
        severity: 'high',
        component: lifecycle.name,
        memoryImpact: leaks.length * 0.1,
        suggestedFix: 'Add cleanup code to useEffect return function or componentWillUnmount',
        metadata: { leaks },
      });
    }
  }

  /**
   * Perform final analysis
   */
  private performFinalAnalysis(): MemoryLeakSuspect[] {
    // Add analysis for resources that are still active
    this.analyzeActiveResources();
    
    // Analyze memory trend
    const trend = this.analyzeMemoryTrend();
    if (trend.direction === 'increasing' && trend.rate > 1) { // More than 1MB/min
      this.addSuspectedLeak({
        type: 'closure',
        description: `Consistent memory growth: ${trend.rate.toFixed(2)}MB/min over ${Math.round(trend.duration / 60)}min`,
        severity: trend.rate > 5 ? 'critical' : 'high',
        memoryImpact: trend.rate * 10, // Projected over 10 minutes
        suggestedFix: 'Profile memory usage to identify growing objects',
        metadata: { trend },
      });
    }

    return this.suspectedLeaks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Analyze active resources for potential leaks
   */
  private analyzeActiveResources(): void {
    const now = Date.now();
    const OLD_RESOURCE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    // Check for old event listeners
    for (const [id, listener] of this.trackedEventListeners) {
      if (now - listener.addedAt > OLD_RESOURCE_THRESHOLD) {
        this.addSuspectedLeak({
          type: 'event-listener',
          description: `Long-lived event listener: ${listener.type} (${Math.round((now - listener.addedAt) / 60000)}min old)`,
          severity: 'medium',
          memoryImpact: 0.01,
          suggestedFix: 'Ensure event listeners are removed when no longer needed',
          location: listener.stackTrace,
          metadata: { listenerType: listener.type, age: now - listener.addedAt },
        });
      }
    }

    // Check for old intervals
    for (const [id, timer] of this.trackedTimers) {
      if (timer.type === 'interval' && now - timer.createdAt > OLD_RESOURCE_THRESHOLD) {
        this.addSuspectedLeak({
          type: 'timer',
          description: `Long-running interval: ${Math.round((now - timer.createdAt) / 60000)}min old`,
          severity: 'high',
          memoryImpact: 0.1,
          suggestedFix: 'Clear intervals when component unmounts or they are no longer needed',
          location: timer.stackTrace,
          metadata: { timerType: timer.type, age: now - timer.createdAt },
        });
      }
    }
  }

  /**
   * Analyze memory trend
   */
  private analyzeMemoryTrend(): MemoryTrend {
    if (this.memorySnapshots.length < 2) {
      return {
        direction: 'stable',
        rate: 0,
        confidence: 0,
        duration: 0,
        snapshots: this.memorySnapshots,
      };
    }

    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000; // seconds
    const memoryChange = last.jsHeapUsed - first.jsHeapUsed;
    const rate = (memoryChange / duration) * 60; // MB per minute

    let direction: 'increasing' | 'stable' | 'decreasing';
    if (Math.abs(rate) < 0.1) {
      direction = 'stable';
    } else if (rate > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Calculate confidence based on consistency of trend
    const confidence = this.calculateTrendConfidence();

    return {
      direction,
      rate: Math.abs(rate),
      confidence,
      duration,
      snapshots: this.memorySnapshots,
    };
  }

  /**
   * Calculate trend confidence
   */
  private calculateTrendConfidence(): number {
    if (this.memorySnapshots.length < 5) return 0;

    // Calculate correlation coefficient
    const n = this.memorySnapshots.length;
    const x = this.memorySnapshots.map((_, i) => i);
    const y = this.memorySnapshots.map(s => s.jsHeapUsed);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : Math.abs(numerator / denominator);
  }

  /**
   * Generate resource summary
   */
  private generateResourceSummary(): {
    activeEventListeners: number;
    activeTimers: number;
    activeObservers: number;
    unmountedComponentsWithResources: number;
  } {
    const unmountedWithResources = Array.from(this.componentLifecycles.values())
      .filter(lifecycle => 
        lifecycle.unmountedAt && 
        Object.values(lifecycle.resources).some(arr => arr.length > 0)
      ).length;

    return {
      activeEventListeners: this.trackedEventListeners.size,
      activeTimers: this.trackedTimers.size,
      activeObservers: this.trackedObservers.size,
      unmountedComponentsWithResources,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.trackedEventListeners.size > 50) {
      recommendations.push('Consider using event delegation instead of multiple event listeners');
    }

    if (this.trackedTimers.size > 20) {
      recommendations.push('Review timer usage and ensure proper cleanup in useEffect');
    }

    const memoryTrend = this.analyzeMemoryTrend();
    if (memoryTrend.direction === 'increasing') {
      recommendations.push('Monitor memory growth and identify components causing memory leaks');
    }

    const unmountedComponents = Array.from(this.componentLifecycles.values())
      .filter(lifecycle => lifecycle.unmountedAt).length;
    
    if (unmountedComponents > 10) {
      recommendations.push('Implement proper cleanup in component unmount lifecycle');
    }

    return recommendations;
  }

  /**
   * Start periodic analysis during monitoring
   */
  private startPeriodicAnalysis(): void {
    const analysisInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(analysisInterval);
        return;
      }

      // Periodic analysis of current state
      const currentSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
      if (currentSnapshot) {
        this.analyzeCurrentSnapshot(currentSnapshot);
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): string {
    const error = new Error();
    return error.stack || '';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Singleton memory leak detector instance
 */
export const memoryLeakDetector = new MemoryLeakDetector();

/**
 * React hook for memory leak monitoring
 */
export function useMemoryLeakMonitoring() {
  return {
    detector: memoryLeakDetector,
    startMonitoring: () => memoryLeakDetector.startMonitoring(),
    stopMonitoring: () => memoryLeakDetector.stopMonitoring(),
    trackComponentMount: (name: string) => memoryLeakDetector.trackComponentMount(name),
    trackComponentUnmount: (name: string) => memoryLeakDetector.trackComponentUnmount(name),
  };
}

/**
 * Higher-order component for automatic memory leak tracking
 */
export function withMemoryLeakTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';

    React.useEffect(() => {
      memoryLeakDetector.trackComponentMount(name);
      
      return () => {
        memoryLeakDetector.trackComponentUnmount(name);
      };
    }, [name]);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withMemoryLeakTracking(${componentName || Component.displayName || Component.name})`;
  return WrappedComponent;
}