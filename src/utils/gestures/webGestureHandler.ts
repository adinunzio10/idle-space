/**
 * WEB GESTURE HANDLER OPTIMIZATIONS
 *
 * Web-specific optimizations for React Native Gesture Handler to resolve
 * browser conflicts and improve touch/mouse input handling on web platforms.
 *
 * Features:
 * - Cross-browser event prevention
 * - Mouse/touch input normalization
 * - Simultaneous gesture optimization
 * - Touch event pooling for garbage collection reduction
 * - Web-optimized worklet configurations
 * - WASM loading optimization with JavaScript fallbacks
 */

import { Platform } from 'react-native';
import { Gesture, GestureType } from 'react-native-gesture-handler';

// Web platform detection
export const IS_WEB = Platform.OS === 'web';

// Browser detection utilities
export const getBrowserInfo = () => {
  if (!IS_WEB || typeof navigator === 'undefined') {
    return { name: 'unknown', version: 0, isTouch: false };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (userAgent.includes('chrome')) {
    return {
      name: 'chrome',
      version: parseInt(userAgent.match(/chrome\/(\d+)/)?.[1] || '0'),
      isTouch,
    };
  } else if (userAgent.includes('firefox')) {
    return {
      name: 'firefox',
      version: parseInt(userAgent.match(/firefox\/(\d+)/)?.[1] || '0'),
      isTouch,
    };
  } else if (userAgent.includes('safari')) {
    return {
      name: 'safari',
      version: parseInt(userAgent.match(/version\/(\d+)/)?.[1] || '0'),
      isTouch,
    };
  } else if (userAgent.includes('edge')) {
    return {
      name: 'edge',
      version: parseInt(userAgent.match(/edge\/(\d+)/)?.[1] || '0'),
      isTouch,
    };
  }

  return { name: 'unknown', version: 0, isTouch };
};

// Touch event pool for memory optimization
class TouchEventPool {
  private pool: any[] = [];
  private maxSize = 50;

  get(): any {
    return this.pool.pop() || {};
  }

  release(event: any): void {
    if (this.pool.length < this.maxSize) {
      // Clear event data before returning to pool
      Object.keys(event).forEach(key => delete event[key]);
      this.pool.push(event);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

export const touchEventPool = new TouchEventPool();

// Web-specific gesture configuration
export interface WebGestureConfig {
  preventDefaults: boolean;
  enableTouchAction: boolean;
  optimizeForMouse: boolean;
  enableSimultaneousGestures: boolean;
  touchSlop: number;
  mouseSlop: number;
  enableEventPooling: boolean;
  enableWasmFallback: boolean;
}

export const DEFAULT_WEB_CONFIG: WebGestureConfig = {
  preventDefaults: true,
  enableTouchAction: true,
  optimizeForMouse: true,
  enableSimultaneousGestures: true,
  touchSlop: 10,
  mouseSlop: 5,
  enableEventPooling: true,
  enableWasmFallback: true,
};

// Global web gesture configuration
let webGestureConfig: WebGestureConfig = { ...DEFAULT_WEB_CONFIG };

export const setWebGestureConfig = (config: Partial<WebGestureConfig>) => {
  webGestureConfig = { ...webGestureConfig, ...config };
};

export const getWebGestureConfig = (): WebGestureConfig => webGestureConfig;

// Enhanced event prevention utilities
export const preventDefaultEvents = (element: HTMLElement | null) => {
  if (!IS_WEB || !element || !webGestureConfig.preventDefaults) return;

  const browserInfo = getBrowserInfo();
  const listeners: {
    event: string;
    handler: EventListener;
    options: any;
  }[] = [];

  // Sophisticated event prevention that maintains accessibility
  const createEventHandler = (eventType: string) => {
    return (e: Event) => {
      // Allow certain events for accessibility
      if (
        e.target &&
        (e.target as HTMLElement).matches(
          'button, input, textarea, select, [tabindex], [role="button"]'
        )
      ) {
        return; // Don't prevent events on interactive elements
      }

      // Handle different event types
      switch (eventType) {
        case 'touchstart':
        case 'touchmove':
          // Always prevent to avoid browser pan/zoom
          e.preventDefault();
          e.stopPropagation();
          break;

        case 'wheel':
          // Prevent zoom but allow intentional scrolling in scrollable containers
          const target = e.target as HTMLElement;
          if (!target.closest('.scrollable-content')) {
            e.preventDefault();
          }
          break;

        case 'contextmenu':
          // Prevent context menu on gesture areas
          e.preventDefault();
          break;

        case 'dragstart':
        case 'selectstart':
          // Prevent drag/selection during gestures
          e.preventDefault();
          break;

        case 'mousedown':
        case 'mousemove':
          // Only prevent if it's part of a gesture (detected by mouse buttons)
          const mouseEvent = e as MouseEvent;
          if (mouseEvent.buttons > 0) {
            // Mouse is being held down
            e.preventDefault();
          }
          break;

        default:
          e.preventDefault();
          e.stopPropagation();
      }
    };
  };

  // Browser-specific event handling
  const events = [
    'touchstart',
    'touchmove',
    'touchend',
    'contextmenu',
    'dragstart',
    'selectstart',
  ];

  // Add mouse events for desktop
  if (!browserInfo.isTouch) {
    events.push('mousedown', 'mousemove', 'mouseup');
  }

  // Add wheel events with special handling
  events.push('wheel');

  // Safari-specific events
  if (browserInfo.name === 'safari') {
    events.push('gesturestart', 'gesturechange', 'gestureend');
  }

  events.forEach(eventType => {
    const handler = createEventHandler(eventType);
    // Only use passive: false for events that actually need preventDefault()
    const needsPreventDefault = [
      'touchstart',
      'touchmove',
      'wheel',
      'contextmenu',
      'dragstart',
      'selectstart',
    ].includes(eventType);
    const options = {
      passive: !needsPreventDefault, // Use passive: true for events that don't prevent default
      capture: true, // Capture to prevent bubbling issues
    };

    element.addEventListener(eventType, handler, options);
    listeners.push({ event: eventType, handler, options });
  });

  // Handle pointer events for better touch/mouse unification
  if (window.PointerEvent) {
    const pointerEvents = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
    ];
    pointerEvents.forEach(eventType => {
      const handler = createEventHandler(eventType);
      // Pointer events need preventDefault for gesture handling
      const options = { passive: false, capture: true };
      element.addEventListener(eventType, handler, options);
      listeners.push({ event: eventType, handler, options });
    });
  }

  // Return cleanup function
  return () => {
    listeners.forEach(({ event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
  };
};

// Touch-action CSS management
export const applyTouchActionCSS = (
  element: HTMLElement | null,
  touchAction: string = 'none'
) => {
  if (!IS_WEB || !element || !webGestureConfig.enableTouchAction) return;

  const style = element.style;
  style.touchAction = touchAction;
  style.webkitTouchCallout = 'none';
  style.webkitUserSelect = 'none';
  style.userSelect = 'none';
  style.webkitTapHighlightColor = 'transparent';

  // Prevent image dragging
  style.webkitUserDrag = 'none';
  style.userDrag = 'none';

  // Optimize for animations
  style.willChange = 'transform';
  style.transform = 'translateZ(0)';
};

// Mouse/touch input normalization
export const normalizeInputEvent = (event: any) => {
  if (!IS_WEB) return event;

  const browserInfo = getBrowserInfo();
  const pooledEvent = webGestureConfig.enableEventPooling
    ? touchEventPool.get()
    : {};

  // Normalize coordinates for different input types
  if (event.type?.startsWith('mouse')) {
    pooledEvent.x = event.clientX;
    pooledEvent.y = event.clientY;
    pooledEvent.inputType = 'mouse';
    pooledEvent.pointerType = 'mouse';
  } else if (event.type?.startsWith('touch')) {
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    pooledEvent.x = touch?.clientX || event.x;
    pooledEvent.y = touch?.clientY || event.y;
    pooledEvent.inputType = 'touch';
    pooledEvent.pointerType = 'touch';
  } else {
    pooledEvent.x = event.x;
    pooledEvent.y = event.y;
    pooledEvent.inputType = 'unknown';
    pooledEvent.pointerType = event.pointerType || 'unknown';
  }

  // Adjust slop based on input type
  if (webGestureConfig.optimizeForMouse) {
    pooledEvent.slop =
      pooledEvent.inputType === 'mouse'
        ? webGestureConfig.mouseSlop
        : webGestureConfig.touchSlop;
  }

  // Browser-specific adjustments
  if (browserInfo.name === 'firefox' && browserInfo.version < 90) {
    // Firefox < 90 has touch coordinate issues
    pooledEvent.x *= window.devicePixelRatio || 1;
    pooledEvent.y *= window.devicePixelRatio || 1;
  }

  return pooledEvent;
};

// Release normalized event back to pool
export const releaseInputEvent = (event: any) => {
  if (IS_WEB && webGestureConfig.enableEventPooling && event) {
    touchEventPool.release(event);
  }
};

// Web-optimized gesture creation utilities
export const createWebOptimizedPanGesture = () => {
  const browserInfo = getBrowserInfo();

  let gesture = Gesture.Pan().shouldCancelWhenOutside(false);

  if (IS_WEB) {
    // Web-specific optimizations
    gesture = gesture
      .minDistance(
        browserInfo.isTouch
          ? webGestureConfig.touchSlop
          : webGestureConfig.mouseSlop
      )
      .enableTrackpadTwoFingerGesture(true);

    // Safari-specific optimizations
    if (browserInfo.name === 'safari') {
      gesture = gesture.maxPointers(1); // Safari sometimes reports phantom touches
    }
  }

  return gesture;
};

export const createWebOptimizedPinchGesture = () => {
  const browserInfo = getBrowserInfo();

  let gesture = Gesture.Pinch();

  if (IS_WEB) {
    // Note: Pinch gesture doesn't support minPointers/maxPointers
    // These constraints are handled internally by the pinch gesture
    // Web-specific pinch optimizations can be added here as needed

    // Firefox trackpad handling - adjust sensitivity if needed
    if (browserInfo.name === 'firefox') {
      // Firefox trackpad gestures work differently - no pointer constraints needed
    }
  }

  return gesture;
};

export const createWebOptimizedTapGesture = () => {
  const browserInfo = getBrowserInfo();

  let gesture = Gesture.Tap().numberOfTaps(1);

  if (IS_WEB) {
    // Adjust timing for mouse vs touch
    if (browserInfo.isTouch) {
      gesture = gesture.maxDelay(300);
    } else {
      gesture = gesture.maxDelay(200); // Faster for mouse clicks
    }
  }

  return gesture;
};

// Simultaneous gesture configuration for web
export const createWebSimultaneousGestures = (gestures: any[]) => {
  if (!IS_WEB || !webGestureConfig.enableSimultaneousGestures) {
    return Gesture.Race(...gestures);
  }

  const browserInfo = getBrowserInfo();

  // Different strategies for different browsers
  if (browserInfo.name === 'chrome' || browserInfo.name === 'edge') {
    // Chrome/Edge handle simultaneous gestures well
    return Gesture.Simultaneous(...gestures);
  } else if (browserInfo.name === 'firefox') {
    // Firefox needs more careful gesture composition
    return Gesture.Race(...gestures);
  } else if (browserInfo.name === 'safari') {
    // Safari has specific touch handling quirks
    return Gesture.Exclusive(...gestures);
  }

  // Default fallback
  return Gesture.Race(...gestures);
};

// Advanced WASM optimization utilities
export interface WasmCapabilities {
  hasWasm: boolean;
  hasStreaming: boolean;
  hasBulkMemory: boolean;
  hasThreads: boolean;
  hasSimd: boolean;
  estimatedPerformance: 'high' | 'medium' | 'low';
}

export const detectWasmCapabilities = async (): Promise<WasmCapabilities> => {
  if (!IS_WEB) {
    return {
      hasWasm: false,
      hasStreaming: false,
      hasBulkMemory: false,
      hasThreads: false,
      hasSimd: false,
      estimatedPerformance: 'low',
    };
  }

  const capabilities: WasmCapabilities = {
    hasWasm: false,
    hasStreaming: false,
    hasBulkMemory: false,
    hasThreads: false,
    hasSimd: false,
    estimatedPerformance: 'low',
  };

  try {
    // Basic WASM support
    if (typeof WebAssembly === 'undefined') {
      return capabilities;
    }
    capabilities.hasWasm = true;

    // Streaming compilation support
    capabilities.hasStreaming =
      typeof WebAssembly.instantiateStreaming === 'function';

    // Test advanced WASM features with minimal modules
    try {
      // Test bulk memory operations
      const bulkMemoryModule = new Uint8Array([
        0x00,
        0x61,
        0x73,
        0x6d,
        0x01,
        0x00,
        0x00,
        0x00, // WASM header
        0x05,
        0x03,
        0x01,
        0x00,
        0x01, // Memory section
        0x0b,
        0x07,
        0x01,
        0x05,
        0x00,
        0xfc,
        0x08,
        0x00,
        0x00, // Bulk memory instruction
      ]);
      await WebAssembly.instantiate(bulkMemoryModule);
      capabilities.hasBulkMemory = true;
    } catch {
      // Bulk memory not supported
    }

    // Test SIMD support
    try {
      const simdModule = new Uint8Array([
        0x00,
        0x61,
        0x73,
        0x6d,
        0x01,
        0x00,
        0x00,
        0x00, // WASM header
        0x01,
        0x05,
        0x01,
        0x60,
        0x01,
        0x7b,
        0x00, // Type section (v128 param)
        0x03,
        0x02,
        0x01,
        0x00, // Function section
        0x0a,
        0x05,
        0x01,
        0x03,
        0x00,
        0x20,
        0x00, // Code section with v128 load
      ]);
      await WebAssembly.instantiate(simdModule);
      capabilities.hasSimd = true;
    } catch {
      // SIMD not supported
    }

    // Check for SharedArrayBuffer (threads support)
    capabilities.hasThreads =
      typeof SharedArrayBuffer !== 'undefined' && typeof Worker !== 'undefined';

    // Estimate performance based on capabilities
    if (
      capabilities.hasSimd &&
      capabilities.hasBulkMemory &&
      capabilities.hasThreads
    ) {
      capabilities.estimatedPerformance = 'high';
    } else if (capabilities.hasWasm && capabilities.hasStreaming) {
      capabilities.estimatedPerformance = 'medium';
    } else {
      capabilities.estimatedPerformance = 'low';
    }
  } catch (error) {
    console.warn(
      '[WebGestureHandler] WASM capability detection failed:',
      error
    );
  }

  return capabilities;
};

export const checkWasmSupport = (): boolean => {
  if (!IS_WEB) return false;

  try {
    if (typeof WebAssembly === 'undefined') return false;

    // Check for streaming compilation support
    if (typeof WebAssembly.instantiateStreaming === 'function') return true;
    if (typeof WebAssembly.instantiate === 'function') return true;

    return false;
  } catch {
    return false;
  }
};

// React Native Reanimated worklet configuration
export const configureWorkletRuntime = (capabilities: WasmCapabilities) => {
  if (!IS_WEB) return;

  try {
    // Configure React Native Reanimated based on WASM capabilities
    const global = globalThis as any;

    if (
      capabilities.estimatedPerformance === 'high' &&
      capabilities.hasThreads
    ) {
      // Use web workers with WASM for maximum performance
      global._WORKLETS_USE_WEB_THREADS = true;
      global._WORKLETS_USE_WASM = true;
      console.log(
        '[WebGestureHandler] Configured worklets for high-performance WASM with threads'
      );
    } else if (capabilities.hasWasm && capabilities.hasStreaming) {
      // Use WASM without threads
      global._WORKLETS_USE_WEB_THREADS = false;
      global._WORKLETS_USE_WASM = true;
      console.log(
        '[WebGestureHandler] Configured worklets for WASM without threads'
      );
    } else {
      // JavaScript fallback
      global._WORKLETS_USE_WEB_THREADS = false;
      global._WORKLETS_USE_WASM = false;
      console.log(
        '[WebGestureHandler] Configured worklets for JavaScript fallback'
      );
    }

    // Set optimal memory configuration
    if (capabilities.hasBulkMemory) {
      global._WORKLETS_BULK_MEMORY = true;
    }

    // Configure SIMD usage
    if (capabilities.hasSimd) {
      global._WORKLETS_USE_SIMD = true;
    }
  } catch (error) {
    console.warn(
      '[WebGestureHandler] Failed to configure worklet runtime:',
      error
    );
    // Fallback to safe defaults
    const global = globalThis as any;
    global._WORKLETS_USE_WEB_THREADS = false;
    global._WORKLETS_USE_WASM = false;
  }
};

export const optimizeWasmLoading = async () => {
  if (!IS_WEB || !webGestureConfig.enableWasmFallback) return;

  console.log('[WebGestureHandler] Starting WASM optimization...');

  const capabilities = await detectWasmCapabilities();

  console.log('[WebGestureHandler] WASM capabilities detected:', {
    hasWasm: capabilities.hasWasm,
    hasStreaming: capabilities.hasStreaming,
    hasBulkMemory: capabilities.hasBulkMemory,
    hasThreads: capabilities.hasThreads,
    hasSimd: capabilities.hasSimd,
    performance: capabilities.estimatedPerformance,
  });

  // Configure worklet runtime based on capabilities
  configureWorkletRuntime(capabilities);

  if (!capabilities.hasWasm) {
    console.warn(
      '[WebGestureHandler] WASM not supported, using JavaScript fallback'
    );
    return capabilities;
  }

  // Pre-warm WASM if supported
  try {
    console.log('[WebGestureHandler] Pre-warming WASM runtime...');

    // Create a minimal WASM module to initialize the runtime
    const minimalWasm = new Uint8Array([
      0x00,
      0x61,
      0x73,
      0x6d, // WASM magic number
      0x01,
      0x00,
      0x00,
      0x00, // WASM version
      0x01,
      0x04,
      0x01,
      0x60, // Type section: function type
      0x00,
      0x00, // No parameters, no return
      0x03,
      0x02,
      0x01,
      0x00, // Function section: one function of type 0
      0x0a,
      0x04,
      0x01,
      0x02, // Code section: one function
      0x00,
      0x0b, // Function body: nop, end
    ]);

    if (capabilities.hasStreaming && typeof fetch !== 'undefined') {
      // Use streaming compilation for better performance
      const blob = new Blob([minimalWasm], { type: 'application/wasm' });
      const url = URL.createObjectURL(blob);

      try {
        await WebAssembly.instantiateStreaming(fetch(url));
        console.log(
          '[WebGestureHandler] WASM streaming pre-warming successful'
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      // Fallback to regular instantiation
      await WebAssembly.instantiate(minimalWasm);
      console.log('[WebGestureHandler] WASM pre-warming successful');
    }

    // Test performance with a simple computation
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await WebAssembly.instantiate(minimalWasm);
    }
    const duration = performance.now() - start;
    console.log(
      `[WebGestureHandler] WASM performance test: ${duration.toFixed(2)}ms for 1000 instantiations`
    );
  } catch (error) {
    console.warn('[WebGestureHandler] WASM pre-warming failed:', error);
    // Reconfigure for JavaScript fallback
    configureWorkletRuntime({
      ...capabilities,
      hasWasm: false,
      estimatedPerformance: 'low',
    });
  }

  return capabilities;
};

// Performance monitoring for web gestures
export class WebGesturePerformanceMonitor {
  private metrics = {
    gestureStart: 0,
    gestureEnd: 0,
    eventCount: 0,
    droppedEvents: 0,
    averageLatency: 0,
  };

  startGesture() {
    this.metrics.gestureStart = performance.now();
    this.metrics.eventCount = 0;
  }

  trackEvent() {
    this.metrics.eventCount++;

    // Detect dropped events (> 20ms gap)
    const now = performance.now();
    if (this.metrics.gestureStart > 0 && now - this.metrics.gestureStart > 20) {
      this.metrics.droppedEvents++;
    }
  }

  endGesture() {
    this.metrics.gestureEnd = performance.now();
    const totalTime = this.metrics.gestureEnd - this.metrics.gestureStart;
    this.metrics.averageLatency =
      totalTime / Math.max(1, this.metrics.eventCount);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      gestureStart: 0,
      gestureEnd: 0,
      eventCount: 0,
      droppedEvents: 0,
      averageLatency: 0,
    };
  }
}

export const webGesturePerformanceMonitor = new WebGesturePerformanceMonitor();

// Advanced touch event handling for gesture conflict resolution
export class WebTouchEventManager {
  private activeTouches = new Map<number, Touch>();
  private touchStartTime = new Map<number, number>();
  private eventListeners: { element: HTMLElement; cleanup: () => void }[] = [];

  constructor() {
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleTouchCancel = this.handleTouchCancel.bind(this);
  }

  private handleTouchStart(e: TouchEvent) {
    const pooledEvent = webGestureConfig.enableEventPooling
      ? touchEventPool.get()
      : {};
    const now = performance.now();

    // Track active touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.activeTouches.set(touch.identifier, touch);
      this.touchStartTime.set(touch.identifier, now);

      // Store normalized event data
      pooledEvent.id = touch.identifier;
      pooledEvent.x = touch.clientX;
      pooledEvent.y = touch.clientY;
      pooledEvent.timestamp = now;
      pooledEvent.phase = 'start';
    }

    // Prevent browser defaults for gesture areas
    if ((e.target as HTMLElement)?.closest('.galaxy-map-container')) {
      e.preventDefault();
    }
  }

  private handleTouchMove(e: TouchEvent) {
    const pooledEvent = webGestureConfig.enableEventPooling
      ? touchEventPool.get()
      : {};

    // Update active touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (this.activeTouches.has(touch.identifier)) {
        this.activeTouches.set(touch.identifier, touch);

        pooledEvent.id = touch.identifier;
        pooledEvent.x = touch.clientX;
        pooledEvent.y = touch.clientY;
        pooledEvent.timestamp = performance.now();
        pooledEvent.phase = 'move';
      }
    }

    // Prevent scrolling/zooming in gesture areas
    if ((e.target as HTMLElement)?.closest('.galaxy-map-container')) {
      e.preventDefault();
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    const pooledEvent = webGestureConfig.enableEventPooling
      ? touchEventPool.get()
      : {};
    const now = performance.now();

    // Remove ended touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const startTime = this.touchStartTime.get(touch.identifier);

      pooledEvent.id = touch.identifier;
      pooledEvent.x = touch.clientX;
      pooledEvent.y = touch.clientY;
      pooledEvent.timestamp = now;
      pooledEvent.duration = startTime ? now - startTime : 0;
      pooledEvent.phase = 'end';

      this.activeTouches.delete(touch.identifier);
      this.touchStartTime.delete(touch.identifier);

      if (webGestureConfig.enableEventPooling) {
        touchEventPool.release(pooledEvent);
      }
    }

    // TouchEnd is now passive - don't prevent default
  }

  private handleTouchCancel(e: TouchEvent) {
    // Clean up cancelled touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.activeTouches.delete(touch.identifier);
      this.touchStartTime.delete(touch.identifier);
    }
  }

  attachToElement(element: HTMLElement) {
    if (!IS_WEB) return;

    const events = [
      {
        type: 'touchstart' as keyof HTMLElementEventMap,
        handler: this.handleTouchStart as EventListener,
        options: { passive: false },
      }, // Needs preventDefault
      {
        type: 'touchmove' as keyof HTMLElementEventMap,
        handler: this.handleTouchMove as EventListener,
        options: { passive: false },
      }, // Needs preventDefault
      {
        type: 'touchend' as keyof HTMLElementEventMap,
        handler: this.handleTouchEnd as EventListener,
        options: { passive: true },
      }, // No preventDefault needed
      {
        type: 'touchcancel' as keyof HTMLElementEventMap,
        handler: this.handleTouchCancel as EventListener,
        options: { passive: true },
      }, // No preventDefault needed
    ];

    events.forEach(({ type, handler, options }) => {
      element.addEventListener(type, handler, options);
    });

    const cleanup = () => {
      events.forEach(({ type, handler }) => {
        element.removeEventListener(type, handler);
      });
    };

    this.eventListeners.push({ element, cleanup });
    return cleanup;
  }

  getActiveTouches(): Touch[] {
    return Array.from(this.activeTouches.values());
  }

  getTouchDuration(identifier: number): number {
    const startTime = this.touchStartTime.get(identifier);
    return startTime ? performance.now() - startTime : 0;
  }

  cleanup() {
    this.eventListeners.forEach(({ cleanup }) => cleanup());
    this.eventListeners.length = 0;
    this.activeTouches.clear();
    this.touchStartTime.clear();
  }
}

// Global touch event manager instance
export const webTouchEventManager = new WebTouchEventManager();

// Enhanced gesture conflict resolution
export const resolveGestureConflict = (
  activeGestures: string[],
  newGesture: string
): string => {
  const browserInfo = getBrowserInfo();

  // Priority mapping based on browser capabilities
  const priorities: Record<string, number> = {
    tap: 1,
    pan: 2,
    pinch: 3,
    rotate: 4,
  };

  // Browser-specific conflict resolution
  if (browserInfo.name === 'firefox') {
    // Firefox handles simultaneous gestures poorly
    return activeGestures.length > 0 ? activeGestures[0] : newGesture;
  }

  if (browserInfo.name === 'safari' && !browserInfo.isTouch) {
    // Desktop Safari needs special handling for trackpad
    if (newGesture === 'pinch' && activeGestures.includes('pan')) {
      return 'pinch'; // Prioritize pinch over pan for trackpad
    }
  }

  // Default priority-based resolution
  const allGestures = [...activeGestures, newGesture];
  return allGestures.sort(
    (a, b) => (priorities[b] || 0) - (priorities[a] || 0)
  )[0];
};

// Cross-browser wheel event handling
export const handleWheelEvent = (
  element: HTMLElement,
  callback: (delta: { x: number; y: number; scale: number }) => void
) => {
  if (!IS_WEB) return;

  const browserInfo = getBrowserInfo();
  let lastWheelEvent = 0;

  const wheelHandler = (e: WheelEvent) => {
    // Prevent default browser zoom/scroll
    e.preventDefault();

    const now = performance.now();
    const deltaTime = now - lastWheelEvent;
    lastWheelEvent = now;

    let deltaX = e.deltaX;
    let deltaY = e.deltaY;
    let scale = 1;

    // Normalize wheel delta across browsers
    if (browserInfo.name === 'firefox') {
      // Firefox uses different delta values
      deltaX *= 16;
      deltaY *= 16;
    }

    // Handle different wheel modes
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaX *= 16; // Convert lines to pixels
      deltaY *= 16;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      deltaX *= 400; // Convert pages to pixels
      deltaY *= 400;
    }

    // Detect zoom gestures (Ctrl+wheel or pinch on trackpad)
    if (
      e.ctrlKey ||
      (browserInfo.name === 'safari' && Math.abs(e.deltaY) > 2)
    ) {
      scale = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out/in
      deltaX = 0;
      deltaY = 0;
    }

    // Throttle wheel events to prevent overwhelming
    if (deltaTime > 16) {
      // ~60fps
      callback({ x: deltaX, y: deltaY, scale });
    }
  };

  element.addEventListener('wheel', wheelHandler, { passive: false });

  return () => {
    element.removeEventListener('wheel', wheelHandler);
  };
};

// Cleanup utilities
export const cleanupWebGestureResources = () => {
  touchEventPool.clear();
  webGesturePerformanceMonitor.reset();
  webTouchEventManager.cleanup();
};

// Initialization
export const initializeWebGestureHandler = async () => {
  if (!IS_WEB) return;

  console.log('[WebGestureHandler] Initializing web gesture optimizations...');

  const browserInfo = getBrowserInfo();
  console.log(
    `[WebGestureHandler] Browser: ${browserInfo.name} ${browserInfo.version}, Touch: ${browserInfo.isTouch}`
  );

  // Run compatibility tests in development mode
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.EXPO_PUBLIC_DEBUG_WEB
  ) {
    try {
      const { webCompatibilityTester } = await import(
        '../testing/WebCompatibilityTester'
      );
      const results = await webCompatibilityTester.runCompatibilityTests();

      console.log(
        `[WebGestureHandler] Compatibility Score: ${results.score}/100`
      );

      if (results.score < 70) {
        console.warn(
          '[WebGestureHandler] Low compatibility score detected:',
          results.score
        );
        console.log(webCompatibilityTester.generateCompatibilityReport());
      }

      // Apply compatibility-based configurations
      if (
        results.issues.some(
          issue => issue.category === 'gesture' && issue.severity === 'critical'
        )
      ) {
        setWebGestureConfig({
          preventDefaults: true,
          enableSimultaneousGestures: false,
          touchSlop: 15,
          mouseSlop: 10,
        });
        console.warn(
          '[WebGestureHandler] Applied conservative gesture configuration due to compatibility issues'
        );
      }
    } catch (error) {
      console.warn('[WebGestureHandler] Compatibility testing failed:', error);
    }
  }

  // Browser-specific configurations
  if (browserInfo.name === 'safari') {
    setWebGestureConfig({
      touchSlop: 15, // Safari needs larger touch slop
      preventDefaults: true,
      enableSimultaneousGestures: browserInfo.version >= 14,
    });

    // Safari-specific fixes
    if (browserInfo.version < 14) {
      console.warn(
        '[WebGestureHandler] Applying Safari < 14 compatibility fixes'
      );
      setWebGestureConfig({
        enableEventPooling: false, // Disable pooling for older Safari
        touchSlop: 20,
      });
    }
  } else if (browserInfo.name === 'firefox') {
    setWebGestureConfig({
      enableSimultaneousGestures: false, // Firefox has gesture conflicts
      mouseSlop: 8,
      touchSlop: 12,
      preventDefaults: true,
    });

    // Firefox-specific fixes
    if (browserInfo.version < 85) {
      console.warn(
        '[WebGestureHandler] Applying Firefox < 85 compatibility fixes'
      );
      setWebGestureConfig({
        enableWasmFallback: false, // Disable WASM for older Firefox
      });
    }
  } else if (browserInfo.name === 'chrome') {
    // Chrome optimizations
    if (browserInfo.version >= 90) {
      setWebGestureConfig({
        enableSimultaneousGestures: true,
        touchSlop: 8,
        mouseSlop: 4,
        enableEventPooling: true,
      });
    }
  } else if (browserInfo.name === 'edge') {
    // Edge optimizations (similar to Chrome)
    setWebGestureConfig({
      enableSimultaneousGestures: true,
      touchSlop: 10,
      mouseSlop: 5,
    });
  } else {
    // Unknown browser - conservative settings
    console.warn(
      '[WebGestureHandler] Unknown browser detected, applying conservative settings'
    );
    setWebGestureConfig({
      preventDefaults: true,
      enableSimultaneousGestures: false,
      touchSlop: 15,
      mouseSlop: 10,
      enableEventPooling: false,
      enableWasmFallback: false,
    });
  }

  // Initialize WASM optimizations
  const wasmCapabilities = await optimizeWasmLoading();

  // Log final configuration
  console.log('[WebGestureHandler] Final configuration:', {
    browser: `${browserInfo.name} ${browserInfo.version}`,
    config: getWebGestureConfig(),
    wasm: wasmCapabilities
      ? {
          hasWasm: wasmCapabilities.hasWasm,
          performance: wasmCapabilities.estimatedPerformance,
        }
      : 'not available',
  });

  console.log('[WebGestureHandler] Web gesture optimizations initialized');
};

// Viewport meta tag management for proper mobile web scaling
export const setupWebViewportMeta = () => {
  if (!IS_WEB) return;

  let viewportMeta = document.querySelector(
    'meta[name="viewport"]'
  ) as HTMLMetaElement;

  if (!viewportMeta) {
    viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    document.head.appendChild(viewportMeta);
  }

  // Optimal viewport settings for gesture handling
  viewportMeta.content = [
    'width=device-width',
    'initial-scale=1.0',
    'maximum-scale=1.0',
    'user-scalable=no',
    'viewport-fit=cover',
    'shrink-to-fit=no',
  ].join(', ');

  // Add touch-action meta for older browsers
  let touchActionMeta = document.querySelector(
    'meta[name="touch-action"]'
  ) as HTMLMetaElement;
  if (!touchActionMeta) {
    touchActionMeta = document.createElement('meta');
    touchActionMeta.name = 'touch-action';
    touchActionMeta.content = 'manipulation';
    document.head.appendChild(touchActionMeta);
  }
};
