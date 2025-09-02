/**
 * WEB GESTURE DEBUGGER
 *
 * Advanced debugging and performance monitoring system for web gesture handling.
 * Provides real-time monitoring, detailed logging, and visual debugging tools.
 *
 * Features:
 * - Real-time gesture event monitoring
 * - Performance metrics tracking
 * - Visual debugging overlays
 * - Touch/mouse interaction visualization
 * - Gesture conflict detection
 * - Memory usage monitoring
 * - Export capabilities for debugging reports
 */

import { Platform } from 'react-native';
import { webGesturePerformanceMonitor } from '../gestures/webGestureHandler';

export interface GestureEvent {
  id: string;
  type: 'touch' | 'mouse' | 'pointer' | 'wheel' | 'gesture';
  action: 'start' | 'move' | 'end' | 'cancel';
  timestamp: number;
  coordinates: { x: number; y: number };
  target: string;
  data: Record<string, any>;
  duration?: number;
  velocity?: { x: number; y: number };
}

export interface PerformanceMetrics {
  frameRate: number;
  eventLatency: number;
  memoryUsage: number;
  gestureResponseTime: number;
  droppedFrames: number;
  activeGestures: number;
  totalEvents: number;
  conflictCount: number;
}

export interface DebugConfiguration {
  enabled: boolean;
  showVisualOverlay: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  trackPerformance: boolean;
  recordEvents: boolean;
  maxEventHistory: number;
  showTouchPoints: boolean;
  showGestureTrails: boolean;
  highlightConflicts: boolean;
}

export class WebGestureDebugger {
  private static instance: WebGestureDebugger;
  private isInitialized = false;
  private config: DebugConfiguration = {
    enabled: false,
    showVisualOverlay: false,
    logLevel: 'info',
    trackPerformance: true,
    recordEvents: true,
    maxEventHistory: 1000,
    showTouchPoints: true,
    showGestureTrails: true,
    highlightConflicts: true,
  };

  private eventHistory: GestureEvent[] = [];
  private activeEvents = new Map<string, GestureEvent>();
  private performanceMetrics: PerformanceMetrics = {
    frameRate: 60,
    eventLatency: 0,
    memoryUsage: 0,
    gestureResponseTime: 0,
    droppedFrames: 0,
    activeGestures: 0,
    totalEvents: 0,
    conflictCount: 0,
  };

  private debugOverlay: HTMLElement | null = null;
  private touchPointsContainer: HTMLElement | null = null;
  private metricsDisplay: HTMLElement | null = null;
  private eventLogger: HTMLElement | null = null;

  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;

  static getInstance(): WebGestureDebugger {
    if (!WebGestureDebugger.instance) {
      WebGestureDebugger.instance = new WebGestureDebugger();
    }
    return WebGestureDebugger.instance;
  }

  private constructor() {}

  initialize(config: Partial<DebugConfiguration> = {}): void {
    if (Platform.OS !== 'web' || this.isInitialized) return;

    this.config = { ...this.config, ...config };

    if (!this.config.enabled) return;

    console.log('[WebGestureDebugger] Initializing web gesture debugging...');

    this.setupEventListeners();
    this.createDebugOverlay();
    this.startPerformanceMonitoring();

    this.isInitialized = true;
    this.log('info', 'WebGestureDebugger initialized', { config: this.config });
  }

  destroy(): void {
    if (!this.isInitialized) return;

    this.removeDebugOverlay();
    this.stopPerformanceMonitoring();
    this.activeEvents.clear();
    this.eventHistory.length = 0;

    this.isInitialized = false;
    this.log('info', 'WebGestureDebugger destroyed');
  }

  updateConfiguration(config: Partial<DebugConfiguration>): void {
    this.config = { ...this.config, ...config };

    if (this.isInitialized) {
      if (this.config.showVisualOverlay && !this.debugOverlay) {
        this.createDebugOverlay();
      } else if (!this.config.showVisualOverlay && this.debugOverlay) {
        this.removeDebugOverlay();
      }
    }
  }

  recordEvent(event: Partial<GestureEvent>): void {
    if (!this.config.enabled || !this.config.recordEvents) return;

    const fullEvent: GestureEvent = {
      id: event.id || this.generateEventId(),
      type: event.type || 'gesture',
      action: event.action || 'start',
      timestamp: event.timestamp || performance.now(),
      coordinates: event.coordinates || { x: 0, y: 0 },
      target: event.target || 'unknown',
      data: event.data || {},
      ...event,
    };

    // Track active events
    if (fullEvent.action === 'start') {
      this.activeEvents.set(fullEvent.id, fullEvent);
      this.performanceMetrics.activeGestures = this.activeEvents.size;
    } else if (fullEvent.action === 'end' || fullEvent.action === 'cancel') {
      const startEvent = this.activeEvents.get(fullEvent.id);
      if (startEvent) {
        fullEvent.duration = fullEvent.timestamp - startEvent.timestamp;
        this.activeEvents.delete(fullEvent.id);
        this.performanceMetrics.activeGestures = this.activeEvents.size;
      }
    }

    // Add to history
    this.eventHistory.push(fullEvent);
    this.performanceMetrics.totalEvents++;

    // Trim history if needed
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.shift();
    }

    // Visual updates
    this.updateTouchPoints(fullEvent);
    this.updateEventLogger(fullEvent);

    this.log('debug', 'Gesture event recorded', fullEvent);
  }

  detectGestureConflict(eventA: GestureEvent, eventB: GestureEvent): boolean {
    const timeDiff = Math.abs(eventA.timestamp - eventB.timestamp);
    const distanceDiff = Math.sqrt(
      Math.pow(eventA.coordinates.x - eventB.coordinates.x, 2) +
        Math.pow(eventA.coordinates.y - eventB.coordinates.y, 2)
    );

    // Potential conflict if events are close in time and space
    const isConflict = timeDiff < 100 && distanceDiff < 50;

    if (isConflict) {
      this.performanceMetrics.conflictCount++;
      this.log('warn', 'Gesture conflict detected', { eventA, eventB });

      if (this.config.highlightConflicts) {
        this.highlightConflictArea(eventA.coordinates, eventB.coordinates);
      }
    }

    return isConflict;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getEventHistory(): GestureEvent[] {
    return [...this.eventHistory];
  }

  getActiveEvents(): GestureEvent[] {
    return Array.from(this.activeEvents.values());
  }

  exportDebugReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      configuration: this.config,
      performance: this.performanceMetrics,
      recentEvents: this.eventHistory.slice(-50), // Last 50 events
      activeEvents: this.getActiveEvents(),
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
    };

    return JSON.stringify(report, null, 2);
  }

  clearHistory(): void {
    this.eventHistory.length = 0;
    this.activeEvents.clear();
    this.performanceMetrics.totalEvents = 0;
    this.performanceMetrics.conflictCount = 0;
    this.log('info', 'Debug history cleared');
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventListeners(): void {
    if (!this.config.enabled) return;

    // Global event listeners for debugging
    const eventTypes = [
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel',
      'mousedown',
      'mousemove',
      'mouseup',
      'wheel',
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
    ];

    eventTypes.forEach(eventType => {
      document.addEventListener(
        eventType,
        e => {
          this.handleDebugEvent(e);
        },
        { passive: true, capture: true }
      );
    });
  }

  private handleDebugEvent(e: Event): void {
    if (!this.config.recordEvents) return;

    const eventData: Partial<GestureEvent> = {
      type: e.type.includes('touch')
        ? 'touch'
        : e.type.includes('mouse')
          ? 'mouse'
          : e.type.includes('pointer')
            ? 'pointer'
            : e.type.includes('wheel')
              ? 'wheel'
              : 'gesture',
      action:
        e.type.includes('start') || e.type.includes('down')
          ? 'start'
          : e.type.includes('move')
            ? 'move'
            : e.type.includes('end') || e.type.includes('up')
              ? 'end'
              : e.type.includes('cancel')
                ? 'cancel'
                : 'move',
      timestamp: performance.now(),
      target: (e.target as HTMLElement)?.tagName || 'unknown',
      data: {
        eventType: e.type,
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        defaultPrevented: e.defaultPrevented,
      },
    };

    // Extract coordinates based on event type
    if (e instanceof TouchEvent && e.touches.length > 0) {
      eventData.coordinates = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      eventData.data.touchCount = e.touches.length;
    } else if (e instanceof MouseEvent) {
      eventData.coordinates = {
        x: e.clientX,
        y: e.clientY,
      };
      eventData.data.buttons = e.buttons;
    } else if (e instanceof PointerEvent) {
      eventData.coordinates = {
        x: e.clientX,
        y: e.clientY,
      };
      eventData.data.pointerId = e.pointerId;
      eventData.data.pointerType = e.pointerType;
    } else if (e instanceof WheelEvent) {
      eventData.coordinates = {
        x: e.clientX,
        y: e.clientY,
      };
      eventData.data.deltaX = e.deltaX;
      eventData.data.deltaY = e.deltaY;
    }

    this.recordEvent(eventData);
  }

  private createDebugOverlay(): void {
    if (!this.config.showVisualOverlay || this.debugOverlay) return;

    this.debugOverlay = document.createElement('div');
    this.debugOverlay.id = 'web-gesture-debug-overlay';
    this.debugOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
      font-family: monospace;
      font-size: 12px;
    `;

    // Touch points container
    this.touchPointsContainer = document.createElement('div');
    this.touchPointsContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;

    // Metrics display
    this.metricsDisplay = document.createElement('div');
    this.metricsDisplay.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 4px;
      min-width: 200px;
      pointer-events: auto;
    `;

    // Event logger
    this.eventLogger = document.createElement('div');
    this.eventLogger.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 4px;
      max-width: 300px;
      max-height: 200px;
      overflow-y: auto;
      pointer-events: auto;
      font-size: 10px;
    `;

    this.debugOverlay.appendChild(this.touchPointsContainer);
    this.debugOverlay.appendChild(this.metricsDisplay);
    this.debugOverlay.appendChild(this.eventLogger);
    document.body.appendChild(this.debugOverlay);

    this.log('info', 'Debug overlay created');
  }

  private removeDebugOverlay(): void {
    if (this.debugOverlay) {
      document.body.removeChild(this.debugOverlay);
      this.debugOverlay = null;
      this.touchPointsContainer = null;
      this.metricsDisplay = null;
      this.eventLogger = null;
      this.log('info', 'Debug overlay removed');
    }
  }

  private updateTouchPoints(event: GestureEvent): void {
    if (!this.config.showTouchPoints || !this.touchPointsContainer) return;

    const touchPointId = `touch-point-${event.id}`;
    let touchPoint = document.getElementById(touchPointId);

    if (event.action === 'start') {
      touchPoint = document.createElement('div');
      touchPoint.id = touchPointId;
      touchPoint.style.cssText = `
        position: absolute;
        width: 20px;
        height: 20px;
        border: 2px solid ${this.getEventTypeColor(event.type)};
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        pointer-events: none;
        transform: translate(-50%, -50%);
        transition: all 0.1s ease;
      `;
      this.touchPointsContainer.appendChild(touchPoint);
    }

    if (touchPoint) {
      touchPoint.style.left = `${event.coordinates.x}px`;
      touchPoint.style.top = `${event.coordinates.y}px`;

      if (event.action === 'end' || event.action === 'cancel') {
        setTimeout(() => {
          if (touchPoint && touchPoint.parentNode) {
            touchPoint.parentNode.removeChild(touchPoint);
          }
        }, 500);
      }
    }
  }

  private updateEventLogger(event: GestureEvent): void {
    if (!this.eventLogger) return;

    const eventElement = document.createElement('div');
    eventElement.style.cssText = `
      margin-bottom: 2px;
      padding: 2px 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      border-left: 3px solid ${this.getEventTypeColor(event.type)};
    `;

    eventElement.innerHTML = `
      <span style="color: #ccc">${new Date(event.timestamp).toLocaleTimeString()}</span>
      <span style="color: ${this.getEventTypeColor(event.type)}">${event.type}</span>
      <span style="color: #fff">${event.action}</span>
      <span style="color: #aaa">(${event.coordinates.x}, ${event.coordinates.y})</span>
    `;

    this.eventLogger.appendChild(eventElement);

    // Keep only recent events visible
    while (this.eventLogger.children.length > 20) {
      this.eventLogger.removeChild(this.eventLogger.firstChild!);
    }

    // Auto-scroll to bottom
    this.eventLogger.scrollTop = this.eventLogger.scrollHeight;
  }

  private getEventTypeColor(type: string): string {
    switch (type) {
      case 'touch':
        return '#4CAF50';
      case 'mouse':
        return '#2196F3';
      case 'pointer':
        return '#FF9800';
      case 'wheel':
        return '#9C27B0';
      default:
        return '#607D8B';
    }
  }

  private highlightConflictArea(
    pointA: { x: number; y: number },
    pointB: { x: number; y: number }
  ): void {
    if (!this.touchPointsContainer) return;

    const conflictOverlay = document.createElement('div');
    conflictOverlay.style.cssText = `
      position: absolute;
      left: ${Math.min(pointA.x, pointB.x) - 25}px;
      top: ${Math.min(pointA.y, pointB.y) - 25}px;
      width: ${Math.abs(pointA.x - pointB.x) + 50}px;
      height: ${Math.abs(pointA.y - pointB.y) + 50}px;
      border: 2px dashed #FF5722;
      background: rgba(255, 87, 34, 0.2);
      pointer-events: none;
      animation: conflict-highlight 1s ease-out forwards;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes conflict-highlight {
        0% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.1); }
      }
    `;
    document.head.appendChild(style);

    this.touchPointsContainer.appendChild(conflictOverlay);

    setTimeout(() => {
      if (conflictOverlay.parentNode) {
        conflictOverlay.parentNode.removeChild(conflictOverlay);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 1000);
  }

  private startPerformanceMonitoring(): void {
    if (!this.config.trackPerformance) return;

    const updateMetrics = () => {
      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;

      if (this.lastFrameTime > 0) {
        this.frameCount++;

        // Calculate frame rate (smoothed)
        const fps = 1000 / deltaTime;
        this.performanceMetrics.frameRate =
          this.performanceMetrics.frameRate * 0.9 + fps * 0.1;

        // Count dropped frames
        if (deltaTime > 20) {
          // More than 20ms = dropped frame at 60fps
          this.performanceMetrics.droppedFrames++;
        }
      }

      this.lastFrameTime = now;

      // Update memory usage if available
      const memoryInfo = (performance as any).memory;
      if (memoryInfo) {
        this.performanceMetrics.memoryUsage =
          memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
      }

      // Get gesture response time from performance monitor
      const webMetrics = webGesturePerformanceMonitor.getMetrics();
      this.performanceMetrics.gestureResponseTime = webMetrics.averageLatency;

      this.updateMetricsDisplay();
      this.animationFrameId = requestAnimationFrame(updateMetrics);
    };

    this.animationFrameId = requestAnimationFrame(updateMetrics);
  }

  private stopPerformanceMonitoring(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateMetricsDisplay(): void {
    if (!this.metricsDisplay) return;

    const metrics = this.performanceMetrics;
    this.metricsDisplay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50;">
        🎮 Web Gesture Debug
      </div>
      <div>FPS: <span style="color: ${metrics.frameRate > 55 ? '#4CAF50' : metrics.frameRate > 30 ? '#FF9800' : '#F44336'}">${metrics.frameRate.toFixed(1)}</span></div>
      <div>Dropped Frames: <span style="color: ${metrics.droppedFrames < 10 ? '#4CAF50' : '#FF9800'}">${metrics.droppedFrames}</span></div>
      <div>Event Latency: <span style="color: ${metrics.eventLatency < 10 ? '#4CAF50' : '#FF9800'}">${metrics.eventLatency.toFixed(1)}ms</span></div>
      <div>Memory Usage: <span style="color: ${metrics.memoryUsage < 0.7 ? '#4CAF50' : '#FF9800'}">${(metrics.memoryUsage * 100).toFixed(1)}%</span></div>
      <div>Active Gestures: <span style="color: #2196F3">${metrics.activeGestures}</span></div>
      <div>Total Events: <span style="color: #9C27B0">${metrics.totalEvents}</span></div>
      <div>Conflicts: <span style="color: ${metrics.conflictCount === 0 ? '#4CAF50' : '#FF5722'}">${metrics.conflictCount}</span></div>
      <div style="margin-top: 8px; font-size: 10px; color: #aaa;">
        <button onclick="window.webGestureDebugger?.clearHistory()" style="background: #333; color: white; border: none; padding: 2px 6px; border-radius: 2px; cursor: pointer;">Clear</button>
        <button onclick="console.log(window.webGestureDebugger?.exportDebugReport())" style="background: #333; color: white; border: none; padding: 2px 6px; border-radius: 2px; cursor: pointer; margin-left: 4px;">Export</button>
      </div>
    `;
  }

  private log(level: string, message: string, data?: any): void {
    if (this.config.logLevel === 'none') return;

    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel =
      levels[this.config.logLevel as keyof typeof levels] ?? 2;
    const messageLevel = levels[level as keyof typeof levels] ?? 2;

    if (messageLevel <= currentLevel) {
      const prefix = '[WebGestureDebugger]';
      const method =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : level === 'debug'
              ? console.debug
              : console.log;

      if (data) {
        method(prefix, message, data);
      } else {
        method(prefix, message);
      }
    }
  }
}

// Global instance for easy access
export const webGestureDebugger = WebGestureDebugger.getInstance();

// Make debugger available on window for browser console access
if (Platform.OS === 'web') {
  (window as any).webGestureDebugger = webGestureDebugger;
}
