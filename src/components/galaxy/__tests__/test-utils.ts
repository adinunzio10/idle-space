/**
 * Comprehensive Test Utilities for GalaxyMapModular Component Tests
 * 
 * Provides reusable test setup utilities building on successful patterns
 * from ModuleStability.simple.test.tsx and integrating with jest-setup.js.
 */

import React from 'react';
import { View } from 'react-native';
import type { Beacon, ViewportState, Connection } from '../../../types/galaxy';
import type { ModuleContext } from '../../../utils/galaxy/modules/types';

// Re-export global test utilities for convenience
export const {
  createMockBeacon: globalCreateMockBeacon,
  createMockViewportState: globalCreateMockViewportState,
  createMockModuleContext: globalCreateMockModuleContext,
} = global || {};

/**
 * Enhanced beacon creation with more options
 */
export function createMockBeacon(
  id: string, 
  position: { x: number; y: number } = { x: 0, y: 0 },
  options: Partial<Beacon> = {}
): Beacon {
  return {
    id,
    position,
    level: 1,
    type: 'pioneer',
    connections: [],
    ...options,
  };
}

/**
 * Creates multiple mock beacons in a grid pattern
 */
export function createMockBeaconGrid(
  width: number, 
  height: number, 
  spacing: number = 100
): Beacon[] {
  const beacons: Beacon[] = [];
  
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      beacons.push(createMockBeacon(
        `beacon-${x}-${y}`,
        { x: x * spacing, y: y * spacing },
        { level: Math.floor(Math.random() * 3) + 1 }
      ));
    }
  }
  
  return beacons;
}

/**
 * Creates mock connections between beacons
 */
export function createMockConnections(beacons: Beacon[]): Connection[] {
  const connections: Connection[] = [];
  
  for (let i = 0; i < beacons.length - 1; i++) {
    if (Math.random() > 0.5) { // 50% chance of connection
      connections.push({
        id: `connection-${beacons[i].id}-${beacons[i + 1].id}`,
        sourceId: beacons[i].id,
        targetId: beacons[i + 1].id,
        strength: Math.floor(Math.random() * 5) + 1, // 1-5
        isActive: Math.random() > 0.3, // 70% chance of being active
        patterns: [], // Empty array for basic mock
      });
    }
  }
  
  return connections;
}

/**
 * Creates a mock viewport state with sensible defaults
 */
export function createMockViewportState(overrides: Partial<ViewportState> = {}): ViewportState {
  return {
    translateX: 0,
    translateY: 0,
    scale: 1,
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 600 },
    ...overrides,
  };
}

/**
 * Creates a mock module context for testing
 */
export function createMockModuleContext(overrides: Partial<ModuleContext> = {}): ModuleContext {
  return {
    viewport: createMockViewportState(),
    screenDimensions: { width: 400, height: 600 },
    beacons: [createMockBeacon('test-beacon')],
    connections: [],
    patterns: [],
    starSystems: [],
    sectors: [],
    deltaTime: 16.67,
    frameCount: 1,
    ...overrides,
  };
}

/**
 * Mock Module Manager for testing module lifecycle
 */
export class TestModuleManager {
  private modules: { id: string; enabled: boolean }[] = [];
  private eventBus: any;
  
  constructor() {
    this.eventBus = {
      subscribe: jest.fn(),
      emit: jest.fn(),
      listeners: new Map(),
    };
  }
  
  addModule(id: string, enabled = true) {
    this.modules.push({ id, enabled });
    return this;
  }
  
  enableModule(id: string) {
    const module = this.modules.find(m => m.id === id);
    if (module) module.enabled = true;
    return this;
  }
  
  disableModule(id: string) {
    const module = this.modules.find(m => m.id === id);
    if (module) module.enabled = false;
    return this;
  }
  
  getEnabledModules() {
    return this.modules.filter(m => m.enabled).map(m => m.id);
  }
  
  getAllModules() {
    return this.modules;
  }
  
  getEventBus() {
    return this.eventBus;
  }
  
  renderModules(context: ModuleContext) {
    return this.modules
      .filter(m => m.enabled)
      .map((module, index) => 
        React.createElement('g', { 
          key: `test-module-${module.id}`, 
          'data-testid': `module-${module.id}`,
          'data-enabled': module.enabled 
        })
      );
  }
  
  reset() {
    this.modules = [];
    this.eventBus.listeners.clear();
  }
}

/**
 * Performance testing utilities
 */
export const performanceTestUtils = {
  /**
   * Measures render time for a component
   */
  measureRenderTime: (renderFn: () => void): number => {
    const start = performance.now();
    renderFn();
    return performance.now() - start;
  },
  
  /**
   * Simulates frame skipping conditions
   */
  simulateFrameSkip: (averageFps: number, targetFps: number = 60): boolean => {
    return averageFps < targetFps * 0.5; // Skip if less than 50% of target FPS
  },
  
  /**
   * Creates performance monitoring mock
   */
  createPerformanceMonitor: () => ({
    startTiming: jest.fn(),
    endTiming: jest.fn(),
    getAverageFps: jest.fn(() => 60),
    shouldSkipFrame: jest.fn(() => false),
    reportPerformance: jest.fn(),
    reset: jest.fn(),
  }),
};

/**
 * Gesture simulation utilities
 */
export const gestureTestUtils = {
  /**
   * Simulates pan gesture sequence
   */
  simulatePanSequence: (
    handler: any,
    start: { x: number; y: number },
    end: { x: number; y: number },
    steps: number = 5
  ) => {
    const sequence = [];
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      sequence.push({
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
        translationX: (end.x - start.x) * progress,
        translationY: (end.y - start.y) * progress,
      });
    }
    
    if (global.GestureTestUtils?.simulatePanGesture) {
      global.GestureTestUtils.simulatePanGesture(handler, sequence);
    }
  },
  
  /**
   * Simulates pinch gesture for zoom testing
   */
  simulatePinchZoom: (
    handler: any,
    initialScale: number,
    finalScale: number,
    focalPoint: { x: number; y: number } = { x: 200, y: 300 }
  ) => {
    if (global.GestureTestUtils?.simulatePinchGesture) {
      global.GestureTestUtils.simulatePinchGesture(handler, finalScale, {
        focalX: focalPoint.x,
        focalY: focalPoint.y,
      });
    }
  },
  
  /**
   * Simulates tap gesture at specific coordinates
   */
  simulateTap: (
    handler: any,
    position: { x: number; y: number }
  ) => {
    if (global.GestureTestUtils?.simulateTapGesture) {
      global.GestureTestUtils.simulateTapGesture(handler, position);
    }
  },
};

/**
 * Worklet testing utilities
 */
export const workletTestUtils = {
  /**
   * Creates a test shared value
   */
  createTestSharedValue: (initialValue: any) => {
    if (global.WorkletTestUtils?.createSharedValue) {
      return global.WorkletTestUtils.createSharedValue(initialValue);
    }
    return { value: initialValue };
  },
  
  /**
   * Executes a worklet in test context
   */
  executeWorklet: (workletFn: Function, args: any[] = []) => {
    if (global.WorkletTestUtils?.executeWorklet) {
      return global.WorkletTestUtils.executeWorklet(workletFn, args);
    }
    return workletFn(...args);
  },
  
  /**
   * Simulates runOnJS callback
   */
  simulateRunOnJS: (callback: Function, args: any[] = []) => {
    if (global.WorkletTestUtils?.runOnJS) {
      const runOnJSCallback = global.WorkletTestUtils.runOnJS(callback);
      return runOnJSCallback(...args);
    }
    return callback(...args);
  },
  
  /**
   * Resets worklet context
   */
  resetWorkletContext: () => {
    if (global.WorkletTestUtils?.resetContext) {
      global.WorkletTestUtils.resetContext();
    }
  },
};

/**
 * Test environment setup utility
 */
export function setupTestEnvironment(options: {
  resetGlobals?: boolean;
  setupPerformanceMonitoring?: boolean;
  enableDebugMode?: boolean;
} = {}) {
  const { resetGlobals = true, setupPerformanceMonitoring = true, enableDebugMode = false } = options;
  
  // Reset global test utilities
  if (resetGlobals) {
    workletTestUtils.resetWorkletContext();
    
    if (global.GestureTestUtils) {
      // Reset gesture test state if needed
    }
  }
  
  // Setup performance monitoring
  if (setupPerformanceMonitoring) {
    const performanceMonitor = performanceTestUtils.createPerformanceMonitor();
    
    // Mock console methods if not in debug mode
    if (!enableDebugMode) {
      const originalWarn = console.warn;
      const originalError = console.error;
      
      console.warn = jest.fn();
      console.error = jest.fn();
      
      return {
        performanceMonitor,
        restoreConsole: () => {
          console.warn = originalWarn;
          console.error = originalError;
        },
      };
    }
    
    return { performanceMonitor };
  }
  
  return {};
}

/**
 * Assertion helpers for galaxy map testing
 */
export const testAssertions = {
  /**
   * Asserts that viewport state is valid
   */
  expectValidViewportState: (viewport: ViewportState) => {
    expect(viewport).toBeDefined();
    expect(typeof viewport.translateX).toBe('number');
    expect(typeof viewport.translateY).toBe('number');
    expect(typeof viewport.scale).toBe('number');
    expect(viewport.scale).toBeGreaterThan(0);
    expect(viewport.bounds).toBeDefined();
  },
  
  /**
   * Asserts that beacon data is valid
   */
  expectValidBeacon: (beacon: Beacon) => {
    expect(beacon).toBeDefined();
    expect(typeof beacon.id).toBe('string');
    expect(beacon.position).toBeDefined();
    expect(typeof beacon.position.x).toBe('number');
    expect(typeof beacon.position.y).toBe('number');
    expect(typeof beacon.level).toBe('number');
    expect(beacon.level).toBeGreaterThanOrEqual(1);
    expect(['pioneer', 'harvester', 'architect']).toContain(beacon.type);
  },
  
  /**
   * Asserts that module context is valid
   */
  expectValidModuleContext: (context: ModuleContext) => {
    testAssertions.expectValidViewportState(context.viewport);
    expect(context.screenDimensions).toBeDefined();
    expect(typeof context.screenDimensions.width).toBe('number');
    expect(typeof context.screenDimensions.height).toBe('number');
    expect(Array.isArray(context.beacons)).toBe(true);
    expect(Array.isArray(context.connections)).toBe(true);
    expect(typeof context.deltaTime).toBe('number');
    expect(typeof context.frameCount).toBe('number');
  },
};

/**
 * Integration test wrapper that combines all utilities
 */
export function createIntegrationTestSuite(suiteName: string) {
  return {
    /**
     * Setup method for test suite
     */
    setup: () => setupTestEnvironment({ enableDebugMode: false }),
    
    /**
     * Creates complete test scenario
     */
    createTestScenario: (name: string, options: {
      beaconCount?: number;
      viewportScale?: number;
      enabledModules?: string[];
    } = {}) => {
      const { beaconCount = 5, viewportScale = 1, enabledModules = [] } = options;
      
      const beacons = createMockBeaconGrid(Math.ceil(Math.sqrt(beaconCount)), Math.ceil(Math.sqrt(beaconCount)));
      const connections = createMockConnections(beacons.slice(0, beaconCount));
      const viewport = createMockViewportState({ scale: viewportScale });
      const moduleManager = new TestModuleManager();
      
      enabledModules.forEach(moduleId => moduleManager.addModule(moduleId, true));
      
      const context = createMockModuleContext({
        beacons: beacons.slice(0, beaconCount),
        connections,
        viewport,
      });
      
      return {
        name: `${suiteName} - ${name}`,
        beacons: beacons.slice(0, beaconCount),
        connections,
        viewport,
        context,
        moduleManager,
      };
    },
    
    /**
     * Cleanup method for test suite
     */
    cleanup: () => {
      workletTestUtils.resetWorkletContext();
    },
  };
}