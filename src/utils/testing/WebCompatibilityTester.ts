/**
 * WEB COMPATIBILITY TESTER
 *
 * Comprehensive cross-browser compatibility testing and feature detection
 * for gesture handling and web performance optimization.
 *
 * Features:
 * - Browser feature detection and capability testing
 * - Gesture compatibility validation
 * - Performance benchmarking across browsers
 * - Automated compatibility reporting
 * - Runtime compatibility adjustments
 */

import { Platform } from 'react-native';

export interface BrowserCapabilities {
  name: string;
  version: number;
  engine: string;
  platform: string;
  features: {
    touchEvents: boolean;
    pointerEvents: boolean;
    passiveEventListeners: boolean;
    intersectionObserver: boolean;
    resizeObserver: boolean;
    visualViewport: boolean;
    webAssembly: boolean;
    webWorkers: boolean;
    sharedArrayBuffer: boolean;
    offscreenCanvas: boolean;
    webGL: boolean;
    webGL2: boolean;
    cssGrid: boolean;
    cssFlexbox: boolean;
    cssCustomProperties: boolean;
    cssTouchAction: boolean;
    cssContainment: boolean;
    cssOverscrollBehavior: boolean;
  };
  quirks: string[];
  compatibility: {
    gestureHandler: 'excellent' | 'good' | 'fair' | 'poor';
    webPerformance: 'excellent' | 'good' | 'fair' | 'poor';
    overall: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

export interface CompatibilityTestResult {
  browser: BrowserCapabilities;
  gestureTests: {
    touchEvents: boolean;
    mouseEvents: boolean;
    wheelEvents: boolean;
    pointerEvents: boolean;
    preventDefault: boolean;
    touchAction: boolean;
    simultaneousGestures: boolean;
  };
  performanceTests: {
    animationFrames: number;
    wasmPerformance: number;
    eventLatency: number;
    memoryUsage: number;
  };
  issues: {
    severity: 'critical' | 'warning' | 'info';
    category: 'gesture' | 'performance' | 'compatibility';
    description: string;
    workaround?: string;
  }[];
  score: number; // 0-100 compatibility score
}

export class WebCompatibilityTester {
  private static instance: WebCompatibilityTester;
  private testResults: CompatibilityTestResult | null = null;
  private isRunning = false;

  static getInstance(): WebCompatibilityTester {
    if (!WebCompatibilityTester.instance) {
      WebCompatibilityTester.instance = new WebCompatibilityTester();
    }
    return WebCompatibilityTester.instance;
  }

  private constructor() {}

  async runCompatibilityTests(): Promise<CompatibilityTestResult> {
    if (Platform.OS !== 'web' || this.isRunning) {
      throw new Error('Compatibility tests can only run on web platform');
    }

    this.isRunning = true;
    console.log(
      '[WebCompatibilityTester] Starting cross-browser compatibility tests...'
    );

    try {
      const browser = await this.detectBrowserCapabilities();
      const gestureTests = await this.runGestureTests();
      const performanceTests = await this.runPerformanceTests();
      const issues = this.analyzeCompatibilityIssues(
        browser,
        gestureTests,
        performanceTests
      );
      const score = this.calculateCompatibilityScore(
        browser,
        gestureTests,
        performanceTests,
        issues
      );

      this.testResults = {
        browser,
        gestureTests,
        performanceTests,
        issues,
        score,
      };

      console.log(
        `[WebCompatibilityTester] Tests completed. Compatibility score: ${score}/100`
      );
      return this.testResults;
    } finally {
      this.isRunning = false;
    }
  }

  private async detectBrowserCapabilities(): Promise<BrowserCapabilities> {
    const userAgent = navigator.userAgent.toLowerCase();
    const capabilities: BrowserCapabilities = {
      name: 'unknown',
      version: 0,
      engine: 'unknown',
      platform: navigator.platform,
      features: {
        touchEvents: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        pointerEvents: 'onpointerdown' in window,
        passiveEventListeners: this.testPassiveEventListeners(),
        intersectionObserver: 'IntersectionObserver' in window,
        resizeObserver: 'ResizeObserver' in window,
        visualViewport: 'visualViewport' in window,
        webAssembly: 'WebAssembly' in window,
        webWorkers: 'Worker' in window,
        sharedArrayBuffer: 'SharedArrayBuffer' in window,
        offscreenCanvas: 'OffscreenCanvas' in window,
        webGL: this.testWebGL(),
        webGL2: this.testWebGL2(),
        cssGrid: CSS.supports('display', 'grid'),
        cssFlexbox: CSS.supports('display', 'flex'),
        cssCustomProperties: CSS.supports('--test', 'test'),
        cssTouchAction: CSS.supports('touch-action', 'none'),
        cssContainment: CSS.supports('contain', 'layout'),
        cssOverscrollBehavior: CSS.supports('overscroll-behavior', 'none'),
      },
      quirks: [],
      compatibility: {
        gestureHandler: 'fair',
        webPerformance: 'fair',
        overall: 'fair',
      },
    };

    // Browser detection
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
      capabilities.name = 'chrome';
      capabilities.version = this.extractVersion(userAgent, /chrome\/(\d+)/);
      capabilities.engine = 'blink';
    } else if (userAgent.includes('firefox')) {
      capabilities.name = 'firefox';
      capabilities.version = this.extractVersion(userAgent, /firefox\/(\d+)/);
      capabilities.engine = 'gecko';
      capabilities.quirks.push(
        'firefox-wheel-events',
        'firefox-touch-precision'
      );
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      capabilities.name = 'safari';
      capabilities.version = this.extractVersion(userAgent, /version\/(\d+)/);
      capabilities.engine = 'webkit';
      capabilities.quirks.push('safari-touch-events', 'safari-wheel-momentum');
    } else if (userAgent.includes('edg')) {
      capabilities.name = 'edge';
      capabilities.version = this.extractVersion(userAgent, /edg\/(\d+)/);
      capabilities.engine = 'blink';
    }

    // Assess compatibility levels
    this.assessCompatibilityLevels(capabilities);

    return capabilities;
  }

  private testPassiveEventListeners(): boolean {
    try {
      let supported = false;
      const options: AddEventListenerOptions = {
        get passive() {
          supported = true;
          return false;
        },
      };
      window.addEventListener('test', () => {}, options);
      window.removeEventListener('test', () => {}, options);
      return supported;
    } catch {
      return false;
    }
  }

  private testWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!context;
    } catch {
      return false;
    }
  }

  private testWebGL2(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2');
      return !!context;
    } catch {
      return false;
    }
  }

  private extractVersion(userAgent: string, regex: RegExp): number {
    const match = userAgent.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  }

  private assessCompatibilityLevels(capabilities: BrowserCapabilities): void {
    // Gesture handler compatibility
    if (
      capabilities.features.pointerEvents &&
      capabilities.features.touchEvents &&
      capabilities.features.cssTouchAction
    ) {
      if (capabilities.name === 'chrome' && capabilities.version >= 90) {
        capabilities.compatibility.gestureHandler = 'excellent';
      } else if (capabilities.name === 'safari' && capabilities.version >= 14) {
        capabilities.compatibility.gestureHandler = 'good';
      } else if (
        capabilities.name === 'firefox' &&
        capabilities.version >= 85
      ) {
        capabilities.compatibility.gestureHandler = 'good';
      } else {
        capabilities.compatibility.gestureHandler = 'fair';
      }
    } else {
      capabilities.compatibility.gestureHandler = 'poor';
    }

    // Web performance compatibility
    if (
      capabilities.features.webAssembly &&
      capabilities.features.offscreenCanvas &&
      capabilities.features.webWorkers
    ) {
      if (
        capabilities.features.sharedArrayBuffer &&
        capabilities.features.webGL2
      ) {
        capabilities.compatibility.webPerformance = 'excellent';
      } else {
        capabilities.compatibility.webPerformance = 'good';
      }
    } else if (capabilities.features.webAssembly) {
      capabilities.compatibility.webPerformance = 'fair';
    } else {
      capabilities.compatibility.webPerformance = 'poor';
    }

    // Overall compatibility
    const levels = [
      capabilities.compatibility.gestureHandler,
      capabilities.compatibility.webPerformance,
    ];
    const scores = { excellent: 4, good: 3, fair: 2, poor: 1 };
    const avgScore =
      levels.reduce((sum, level) => sum + scores[level], 0) / levels.length;

    if (avgScore >= 3.5) capabilities.compatibility.overall = 'excellent';
    else if (avgScore >= 2.5) capabilities.compatibility.overall = 'good';
    else if (avgScore >= 1.5) capabilities.compatibility.overall = 'fair';
    else capabilities.compatibility.overall = 'poor';
  }

  private async runGestureTests() {
    const gestureTests = {
      touchEvents: false,
      mouseEvents: false,
      wheelEvents: false,
      pointerEvents: false,
      preventDefault: false,
      touchAction: false,
      simultaneousGestures: false,
    };

    // Create test element
    const testElement = document.createElement('div');
    testElement.style.cssText = `
      position: fixed;
      top: -100px;
      left: -100px;
      width: 50px;
      height: 50px;
      touch-action: none;
      pointer-events: auto;
    `;
    document.body.appendChild(testElement);

    try {
      // Test touch events
      gestureTests.touchEvents = await this.testTouchEvents(testElement);

      // Test mouse events
      gestureTests.mouseEvents = await this.testMouseEvents(testElement);

      // Test wheel events
      gestureTests.wheelEvents = await this.testWheelEvents(testElement);

      // Test pointer events
      gestureTests.pointerEvents = await this.testPointerEvents(testElement);

      // Test preventDefault
      gestureTests.preventDefault = await this.testPreventDefault(testElement);

      // Test touch-action CSS
      gestureTests.touchAction = await this.testTouchAction(testElement);

      // Test simultaneous gestures (simplified)
      gestureTests.simultaneousGestures =
        gestureTests.touchEvents && gestureTests.pointerEvents;
    } finally {
      document.body.removeChild(testElement);
    }

    return gestureTests;
  }

  private async testTouchEvents(element: HTMLElement): Promise<boolean> {
    return new Promise(resolve => {
      let touched = false;
      const timeout = setTimeout(() => resolve(touched), 100);

      const handler = () => {
        touched = true;
        clearTimeout(timeout);
        resolve(true);
      };

      element.addEventListener('touchstart', handler, { once: true });

      // Simulate touch event
      if ('ontouchstart' in window) {
        const touchEvent = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [],
        });
        element.dispatchEvent(touchEvent);
      }
    });
  }

  private async testMouseEvents(element: HTMLElement): Promise<boolean> {
    return new Promise(resolve => {
      let clicked = false;
      const timeout = setTimeout(() => resolve(clicked), 100);

      const handler = () => {
        clicked = true;
        clearTimeout(timeout);
        resolve(true);
      };

      element.addEventListener('mousedown', handler, { once: true });

      // Simulate mouse event
      const mouseEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      });
      element.dispatchEvent(mouseEvent);
    });
  }

  private async testWheelEvents(element: HTMLElement): Promise<boolean> {
    return new Promise(resolve => {
      let wheeled = false;
      const timeout = setTimeout(() => resolve(wheeled), 100);

      const handler = () => {
        wheeled = true;
        clearTimeout(timeout);
        resolve(true);
      };

      element.addEventListener('wheel', handler, { once: true });

      // Simulate wheel event
      const wheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 0,
        deltaY: 100,
      });
      element.dispatchEvent(wheelEvent);
    });
  }

  private async testPointerEvents(element: HTMLElement): Promise<boolean> {
    if (!('PointerEvent' in window)) return false;

    return new Promise(resolve => {
      let pointed = false;
      const timeout = setTimeout(() => resolve(pointed), 100);

      const handler = () => {
        pointed = true;
        clearTimeout(timeout);
        resolve(true);
      };

      element.addEventListener('pointerdown', handler, { once: true });

      // Simulate pointer event
      const pointerEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      element.dispatchEvent(pointerEvent);
    });
  }

  private async testPreventDefault(element: HTMLElement): Promise<boolean> {
    return new Promise(resolve => {
      let prevented = false;
      const timeout = setTimeout(() => resolve(prevented), 100);

      const handler = (e: Event) => {
        try {
          e.preventDefault();
          prevented = !e.defaultPrevented === false; // Double negative for clarity
          clearTimeout(timeout);
          resolve(prevented);
        } catch {
          resolve(false);
        }
      };

      element.addEventListener('click', handler, { once: true });

      // Simulate click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(clickEvent);
    });
  }

  private async testTouchAction(element: HTMLElement): Promise<boolean> {
    const computedStyle = getComputedStyle(element);
    return computedStyle.touchAction === 'none';
  }

  private async runPerformanceTests() {
    const performanceTests = {
      animationFrames: 0,
      wasmPerformance: 0,
      eventLatency: 0,
      memoryUsage: 0,
    };

    // Test animation frame rate
    performanceTests.animationFrames = await this.testAnimationFrameRate();

    // Test WASM performance
    performanceTests.wasmPerformance = await this.testWasmPerformance();

    // Test event latency
    performanceTests.eventLatency = await this.testEventLatency();

    // Test memory usage (if available)
    performanceTests.memoryUsage = this.testMemoryUsage();

    return performanceTests;
  }

  private async testAnimationFrameRate(): Promise<number> {
    return new Promise(resolve => {
      let frameCount = 0;
      const startTime = performance.now();
      const duration = 1000; // 1 second test

      const frame = () => {
        frameCount++;
        if (performance.now() - startTime < duration) {
          requestAnimationFrame(frame);
        } else {
          resolve(frameCount);
        }
      };

      requestAnimationFrame(frame);
    });
  }

  private async testWasmPerformance(): Promise<number> {
    if (!('WebAssembly' in window)) return 0;

    try {
      const wasmCode = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60,
        0x02, 0x7f, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x0a, 0x09, 0x01,
        0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
      ]);

      const wasmModule = await WebAssembly.instantiate(wasmCode);
      const addFunction = wasmModule.instance.exports.exported_func as (
        a: number,
        b: number
      ) => number;

      const iterations = 100000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        addFunction(i, i + 1);
      }

      const endTime = performance.now();
      return iterations / (endTime - startTime); // Operations per millisecond
    } catch {
      return 0;
    }
  }

  private async testEventLatency(): Promise<number> {
    return new Promise(resolve => {
      const testElement = document.createElement('div');
      testElement.style.cssText =
        'position: fixed; top: -100px; left: -100px; width: 1px; height: 1px;';
      document.body.appendChild(testElement);

      const startTime = performance.now();

      const handler = () => {
        const latency = performance.now() - startTime;
        document.body.removeChild(testElement);
        resolve(latency);
      };

      testElement.addEventListener('click', handler, { once: true });

      // Dispatch click immediately
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      testElement.dispatchEvent(clickEvent);
    });
  }

  private testMemoryUsage(): number {
    try {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo) {
        return memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
      }
    } catch {
      // Memory info not available
    }
    return 0;
  }

  private analyzeCompatibilityIssues(
    browser: BrowserCapabilities,
    gestureTests: any,
    performanceTests: any
  ) {
    const issues: CompatibilityTestResult['issues'] = [];

    // Critical issues
    if (!browser.features.touchEvents && !browser.features.pointerEvents) {
      issues.push({
        severity: 'critical',
        category: 'gesture',
        description: 'Neither touch events nor pointer events are supported',
        workaround: 'Fallback to mouse events only',
      });
    }

    if (!browser.features.cssTouchAction) {
      issues.push({
        severity: 'critical',
        category: 'gesture',
        description: 'CSS touch-action property not supported',
        workaround: 'Use JavaScript event prevention instead',
      });
    }

    // Warnings
    if (browser.name === 'safari' && browser.version < 14) {
      issues.push({
        severity: 'warning',
        category: 'compatibility',
        description: 'Safari version may have gesture handling quirks',
        workaround: 'Apply Safari-specific gesture configurations',
      });
    }

    if (browser.name === 'firefox' && !browser.features.passiveEventListeners) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        description: 'Passive event listeners not supported',
        workaround: 'Use active event listeners with manual optimization',
      });
    }

    if (performanceTests.animationFrames < 50) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        description: `Low animation frame rate detected: ${performanceTests.animationFrames}fps`,
        workaround: 'Enable performance mode and reduce visual effects',
      });
    }

    // Info
    if (!browser.features.webAssembly) {
      issues.push({
        severity: 'info',
        category: 'performance',
        description: 'WebAssembly not supported',
        workaround: 'Using JavaScript fallback for worklets',
      });
    }

    return issues;
  }

  private calculateCompatibilityScore(
    browser: BrowserCapabilities,
    gestureTests: any,
    performanceTests: any,
    issues: any[]
  ): number {
    let score = 100;

    // Deduct for critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    score -= criticalIssues * 30;

    // Deduct for warnings
    const warningIssues = issues.filter(i => i.severity === 'warning').length;
    score -= warningIssues * 10;

    // Deduct for failed gesture tests
    const failedGestureTests = Object.values(gestureTests).filter(
      test => !test
    ).length;
    score -= failedGestureTests * 5;

    // Performance adjustments
    if (performanceTests.animationFrames < 30) score -= 10;
    if (performanceTests.wasmPerformance === 0) score -= 5;
    if (performanceTests.eventLatency > 50) score -= 5;

    // Browser-specific adjustments
    if (browser.compatibility.overall === 'excellent') score += 5;
    else if (browser.compatibility.overall === 'poor') score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  getLastTestResults(): CompatibilityTestResult | null {
    return this.testResults;
  }

  generateCompatibilityReport(): string {
    if (!this.testResults) {
      return 'No compatibility tests have been run yet.';
    }

    const { browser, gestureTests, performanceTests, issues, score } =
      this.testResults;

    let report = `
=== Web Compatibility Test Report ===

Browser Information:
- Name: ${browser.name} ${browser.version}
- Engine: ${browser.engine}
- Platform: ${browser.platform}
- Overall Compatibility: ${browser.compatibility.overall}

Compatibility Score: ${score}/100

Feature Support:
- Touch Events: ${browser.features.touchEvents ? '✅' : '❌'}
- Pointer Events: ${browser.features.pointerEvents ? '✅' : '❌'}
- CSS Touch Action: ${browser.features.cssTouchAction ? '✅' : '❌'}
- WebAssembly: ${browser.features.webAssembly ? '✅' : '❌'}
- Web Workers: ${browser.features.webWorkers ? '✅' : '❌'}
- WebGL: ${browser.features.webGL ? '✅' : '❌'}

Gesture Tests:
- Touch Events: ${gestureTests.touchEvents ? '✅' : '❌'}
- Mouse Events: ${gestureTests.mouseEvents ? '✅' : '❌'}
- Wheel Events: ${gestureTests.wheelEvents ? '✅' : '❌'}
- Pointer Events: ${gestureTests.pointerEvents ? '✅' : '❌'}
- Prevent Default: ${gestureTests.preventDefault ? '✅' : '❌'}
- Touch Action: ${gestureTests.touchAction ? '✅' : '❌'}

Performance Tests:
- Animation Frame Rate: ${performanceTests.animationFrames.toFixed(1)}fps
- WASM Performance: ${performanceTests.wasmPerformance.toFixed(1)} ops/ms
- Event Latency: ${performanceTests.eventLatency.toFixed(2)}ms
- Memory Usage: ${(performanceTests.memoryUsage * 100).toFixed(1)}%

Issues Found:
`;

    if (issues.length === 0) {
      report += '- No issues detected\n';
    } else {
      issues.forEach((issue, index) => {
        report += `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}\n`;
        if (issue.workaround) {
          report += `   Workaround: ${issue.workaround}\n`;
        }
      });
    }

    report += '\n=== End of Report ===';
    return report;
  }
}

// Global instance for easy access
export const webCompatibilityTester = WebCompatibilityTester.getInstance();
