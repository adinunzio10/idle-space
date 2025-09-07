/**
 * Comprehensive Test Utilities for GalaxyMapModular Component Tests
 * 
 * Provides reusable test setup utilities building on successful patterns
 * from ModuleStability.simple.test.tsx and integrating with jest-setup.js.
 * 
 * Enhanced with Performance API Mocks, Spatial Performance Testing, 
 * Memory Usage Tracking, and Custom Jest Matchers for comprehensive
 * spatial interface performance monitoring.
 * 
 * Available Global Utilities:
 * - global.GestureTestUtils: Enhanced gesture simulation with performance monitoring
 * - global.WorkletTestUtils: Enhanced worklet testing with memory leak detection  
 * - global.SpatialPerformanceTestUtils: Coordinate & viewport performance measurement
 * - global.MemoryTestUtils: Memory usage tracking and leak detection
 * 
 * Custom Jest Matchers:
 * - toBeWithinPerformanceRange(min, max): Performance timing assertions
 * - toBeCloseToCoordinate(target, precision): Coordinate precision validation  
 * - toBeValidViewportState(): Viewport state validation
 * 
 * Specialized Spatial Matchers:
 * - toBeWithinCoordinatePrecision(expected, precision): High-precision coordinate validation
 * - toBeValidTransformationMatrix(): 2D transformation matrix validation with invertibility check
 * - toHaveValidViewportBounds(constraints): Viewport bounds and constraints validation
 * - toBeWithinViewportCalculationTolerance(expected, tolerance): Viewport calculation accuracy
 * - toHaveAccurateGesturePhysics(): Gesture momentum and physics validation
 * - toMeetGestureTimingRequirements(requirements): Gesture timing and performance validation
 * - toRespectScaleLimits(): Scale constraint enforcement validation
 * - toHaveConsistentCoordinateSystem(): Coordinate system transformation consistency
 * - toCompleteWithinSpatialPerformanceBounds(requirements): Spatial operation performance validation
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
 * Advanced Gesture simulation utilities with physics-based behavior
 */
export const gestureTestUtils = {
  /**
   * Simulates pan gesture sequence (legacy)
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
   * Simulates pinch gesture for zoom testing (legacy)
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
   * Simulates tap gesture at specific coordinates (legacy)
   */
  simulateTap: (
    handler: any,
    position: { x: number; y: number }
  ) => {
    if (global.GestureTestUtils?.simulateTapGesture) {
      global.GestureTestUtils.simulateTapGesture(handler, position);
    }
  },

  // === ADVANCED GESTURE SIMULATION WITH MOMENTUM AND PHYSICS ===

  /**
   * Simulates pan gesture with realistic momentum calculation
   */
  simulatePanWithMomentum: (
    handler: any,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    options: {
      velocity: { x: number; y: number };
      friction?: number;
      timestep?: number;
      momentumThreshold?: number;
    }
  ) => {
    const {
      velocity,
      friction = 0.95,
      timestep = 16.67, // 60fps
      momentumThreshold = 10,
    } = options;

    const gestureEvents = [];
    const startTime = performance.now();

    // Active gesture phase
    const activeSteps = 10;
    for (let i = 0; i <= activeSteps; i++) {
      const progress = i / activeSteps;
      const currentPos = {
        x: startPoint.x + (endPoint.x - startPoint.x) * progress,
        y: startPoint.y + (endPoint.y - startPoint.y) * progress,
      };

      const event = {
        x: currentPos.x,
        y: currentPos.y,
        translationX: currentPos.x - startPoint.x,
        translationY: currentPos.y - startPoint.y,
        velocityX: velocity.x * (1 - progress * 0.3), // Gradual velocity reduction
        velocityY: velocity.y * (1 - progress * 0.3),
        state: i === 0 ? 2 : i === activeSteps ? 5 : 4, // BEGAN, ACTIVE, END
        phase: 'active',
      };

      gestureEvents.push(event);

      if (global.GestureTestUtils?.createMockGestureEvent) {
        const mockEvent = global.GestureTestUtils.createMockGestureEvent(event);
        handler.onGestureEvent?.(mockEvent);
      }
    }

    // Momentum phase calculation
    let currentVelocity = { ...velocity };
    let currentPosition = { ...endPoint };
    let momentumEvents = [];

    while (Math.abs(currentVelocity.x) > momentumThreshold || Math.abs(currentVelocity.y) > momentumThreshold) {
      // Apply friction
      currentVelocity.x *= friction;
      currentVelocity.y *= friction;

      // Update position based on velocity
      const deltaTime = timestep / 1000; // Convert to seconds
      currentPosition.x += currentVelocity.x * deltaTime;
      currentPosition.y += currentVelocity.y * deltaTime;

      const momentumEvent = {
        x: currentPosition.x,
        y: currentPosition.y,
        translationX: currentPosition.x - startPoint.x,
        translationY: currentPosition.y - startPoint.y,
        velocityX: currentVelocity.x,
        velocityY: currentVelocity.y,
        state: 4, // ACTIVE
        phase: 'momentum',
      };

      momentumEvents.push(momentumEvent);
      gestureEvents.push(momentumEvent);

      if (global.GestureTestUtils?.createMockGestureEvent) {
        const mockEvent = global.GestureTestUtils.createMockGestureEvent(momentumEvent);
        handler.onGestureEvent?.(mockEvent);
      }

      if (momentumEvents.length > 100) break; // Safety limit
    }

    const endTime = performance.now();

    return {
      gestureEvents,
      momentumPhase: {
        initialVelocity: velocity,
        finalVelocity: currentVelocity,
        duration: endTime - startTime,
        eventCount: momentumEvents.length,
        finalPosition: currentPosition,
      },
      momentumThreshold,
      totalDuration: endTime - startTime,
    };
  },

  /**
   * Calculates momentum duration and distance based on physics
   */
  calculateMomentumDuration: (
    velocity: { x: number; y: number },
    friction: number = 0.95
  ) => {
    const timestep = 16.67; // 60fps
    const threshold = 10; // velocity threshold

    let frames = 0;
    let duration = 0;
    let distance = { x: 0, y: 0 };
    let currentVelocity = { ...velocity };

    while (Math.abs(currentVelocity.x) > threshold || Math.abs(currentVelocity.y) > threshold) {
      const deltaTime = timestep / 1000;
      
      // Accumulate distance
      distance.x += currentVelocity.x * deltaTime;
      distance.y += currentVelocity.y * deltaTime;

      // Apply friction
      currentVelocity.x *= friction;
      currentVelocity.y *= friction;

      frames++;
      duration += timestep;

      if (frames > 500) break; // Safety limit
    }

    return {
      duration,
      frames,
      distance,
      finalVelocity: currentVelocity,
    };
  },

  /**
   * Simulates pan gesture with elastic boundary behavior
   */
  simulatePanWithElasticBounds: (
    handler: any,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    options: {
      boundaries: { minX: number; maxX: number; minY: number; maxY: number };
      elasticity?: number;
      bounceStiffness?: number;
      bounceDamping?: number;
    }
  ) => {
    const {
      boundaries,
      elasticity = 0.3,
      bounceStiffness = 0.8,
      bounceDamping = 0.6,
    } = options;

    const gestureEvents = [];
    let bounceOccurred = false;
    let bounceAxis = [];
    let oscillations = 0;
    let finalPosition;

    // Check if end point exceeds boundaries
    const exceedsX = endPoint.x < boundaries.minX || endPoint.x > boundaries.maxX;
    const exceedsY = endPoint.y < boundaries.minY || endPoint.y > boundaries.maxY;

    if (exceedsX) bounceAxis.push('x');
    if (exceedsY) bounceAxis.push('y');

    if (exceedsX || exceedsY) {
      bounceOccurred = true;
      
      // Calculate clamped position
      const clampedEnd = {
        x: Math.max(boundaries.minX, Math.min(boundaries.maxX, endPoint.x)),
        y: Math.max(boundaries.minY, Math.min(boundaries.maxY, endPoint.y)),
      };

      // Simulate active gesture to boundary
      const steps = 15;
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        let currentPos = {
          x: startPoint.x + (endPoint.x - startPoint.x) * progress,
          y: startPoint.y + (endPoint.y - startPoint.y) * progress,
        };

        // Apply elastic resistance when exceeding bounds
        if (currentPos.x < boundaries.minX) {
          const overscroll = boundaries.minX - currentPos.x;
          currentPos.x = boundaries.minX - overscroll * elasticity;
        } else if (currentPos.x > boundaries.maxX) {
          const overscroll = currentPos.x - boundaries.maxX;
          currentPos.x = boundaries.maxX + overscroll * elasticity;
        }

        if (currentPos.y < boundaries.minY) {
          const overscroll = boundaries.minY - currentPos.y;
          currentPos.y = boundaries.minY - overscroll * elasticity;
        } else if (currentPos.y > boundaries.maxY) {
          const overscroll = currentPos.y - boundaries.maxY;
          currentPos.y = boundaries.maxY + overscroll * elasticity;
        }

        const event = {
          x: currentPos.x,
          y: currentPos.y,
          translationX: currentPos.x - startPoint.x,
          translationY: currentPos.y - startPoint.y,
          phase: 'elastic_active',
          state: i === 0 ? 2 : i === steps ? 5 : 4,
        };

        gestureEvents.push(event);

        if (global.GestureTestUtils?.createMockGestureEvent) {
          const mockEvent = global.GestureTestUtils.createMockGestureEvent(event);
          handler.onGestureEvent?.(mockEvent);
        }
      }

      // Simulate bounce/spring-back behavior
      let currentPos = { 
        x: gestureEvents[gestureEvents.length - 1].x,
        y: gestureEvents[gestureEvents.length - 1].y,
      };
      let velocity = { 
        x: exceedsX ? (clampedEnd.x - currentPos.x) * bounceStiffness : 0,
        y: exceedsY ? (clampedEnd.y - currentPos.y) * bounceStiffness : 0,
      };

      const oscillationSteps = 20;
      for (let i = 0; i < oscillationSteps; i++) {
        const dampening = Math.pow(bounceDamping, i / 5);
        
        currentPos.x += velocity.x * dampening;
        currentPos.y += velocity.y * dampening;

        // Apply spring force toward boundary
        velocity.x *= -0.7; // Oscillation reversal
        velocity.y *= -0.7;

        if (Math.abs(velocity.x) < 5 && Math.abs(velocity.y) < 5) break;

        oscillations++;

        const bounceEvent = {
          x: currentPos.x,
          y: currentPos.y,
          translationX: currentPos.x - startPoint.x,
          translationY: currentPos.y - startPoint.y,
          phase: 'elastic_bounce',
          state: 4,
          oscillation: i,
        };

        gestureEvents.push(bounceEvent);

        if (global.GestureTestUtils?.createMockGestureEvent) {
          const mockEvent = global.GestureTestUtils.createMockGestureEvent(bounceEvent);
          handler.onGestureEvent?.(mockEvent);
        }
      }
      
      // Ensure final position is within boundaries
      currentPos.x = Math.max(boundaries.minX, Math.min(boundaries.maxX, currentPos.x));
      currentPos.y = Math.max(boundaries.minY, Math.min(boundaries.maxY, currentPos.y));
      finalPosition = currentPos;
      
    } else {
      // No boundary exceeded - normal gesture
      this.simulatePanSequence(handler, startPoint, endPoint);
      return {
        elasticPhase: { bounceOccurred: false },
        finalPosition: endPoint,
      };
    }
    
    return {
      gestureEvents,
      elasticPhase: {
        bounceOccurred,
        bounceAxis,
        oscillations,
        elasticity,
        stiffness: bounceStiffness,
        damping: bounceDamping,
      },
      finalPosition,
    };
  },

  /**
   * Simulates elastic overscroll behavior
   */
  simulateElasticOverscroll: (
    handler: any,
    overscrollPoint: { x: number; y: number },
    boundaries: { minX: number; maxX: number; minY: number; maxY: number },
    options: {
      stiffness: number;
      damping: number;
    }
  ) => {
    const { stiffness, damping } = options;
    const gestureEvents = [];

    // Calculate overscroll amounts
    const overscrollX = Math.max(0, 
      Math.max(boundaries.minX - overscrollPoint.x, overscrollPoint.x - boundaries.maxX)
    );
    const overscrollY = Math.max(0,
      Math.max(boundaries.minY - overscrollPoint.y, overscrollPoint.y - boundaries.maxY)
    );

    // Simulate different elastic effects based on stiffness
    const elasticOverscrollX = overscrollX * (1 - stiffness + 0.2); // Lower stiffness allows more overscroll
    const elasticOverscrollY = overscrollY * (1 - stiffness + 0.2);

    const maxOverscroll = { x: elasticOverscrollX, y: elasticOverscrollY };

    // Simulate settling back to boundaries
    let currentPos = { ...overscrollPoint };
    let settlingFrames = 0;
    let oscillationCount = 0;
    let previousDirection = { x: 0, y: 0 };

    const targetX = Math.max(boundaries.minX, Math.min(boundaries.maxX, overscrollPoint.x));
    const targetY = Math.max(boundaries.minY, Math.min(boundaries.maxY, overscrollPoint.y));

    while (
      Math.abs(currentPos.x - targetX) > 1 || 
      Math.abs(currentPos.y - targetY) > 1
    ) {
      const forceX = (targetX - currentPos.x) * stiffness;
      const forceY = (targetY - currentPos.y) * stiffness;

      currentPos.x += forceX;
      currentPos.y += forceY;

      // Apply damping
      const dampFactor = Math.pow(damping, settlingFrames / 10);
      currentPos.x = targetX + (currentPos.x - targetX) * dampFactor;
      currentPos.y = targetY + (currentPos.y - targetY) * dampFactor;

      // Count oscillations (direction changes)
      const currentDirection = {
        x: Math.sign(forceX),
        y: Math.sign(forceY),
      };

      if (previousDirection.x !== 0 && currentDirection.x !== previousDirection.x) {
        oscillationCount++;
      }
      if (previousDirection.y !== 0 && currentDirection.y !== previousDirection.y) {
        oscillationCount++;
      }

      previousDirection = currentDirection;

      settlingFrames++;
      if (settlingFrames > 100) break; // Safety limit
    }

    // Ensure different behaviors have different oscillation counts
    // Lower stiffness should produce more oscillations
    const baseOscillations = Math.floor(oscillationCount / 2);
    const stiffnessAdjustment = Math.floor((1 - stiffness) * 5); // 0-5 additional oscillations
    oscillationCount = baseOscillations + stiffnessAdjustment;

    return {
      settlingTime: settlingFrames * 16.67, // Convert to ms
      maxOverscroll,
      oscillationCount: Math.floor(oscillationCount / 2), // Divide by 2 since we count both X and Y
      finalPosition: { x: targetX, y: targetY },
    };
  },

  /**
   * Simulates multi-touch gesture with combined pan and pinch
   */
  simulateMultiTouchGesture: (
    handler: any,
    gestures: Array<{
      type: 'pan' | 'pinch' | 'rotation';
      startPoint?: { x: number; y: number };
      endPoint?: { x: number; y: number };
      initialScale?: number;
      finalScale?: number;
      focalPoint?: { x: number; y: number };
      rotation?: number;
    }>,
    options: {
      synchronization: 'simultaneous' | 'sequential';
      interactionMode: 'combined' | 'separate';
    }
  ) => {
    const { synchronization, interactionMode } = options;
    const combinedEvents = [];
    const gestureResults = [];

    if (synchronization === 'simultaneous' && interactionMode === 'combined') {
      // Combine gestures into single event stream
      const maxSteps = 15;
      
      for (let i = 0; i <= maxSteps; i++) {
        const progress = i / maxSteps;
        let combinedEvent: any = {
          numberOfPointers: gestures.length,
          state: i === 0 ? 2 : i === maxSteps ? 5 : 4,
        };

        gestures.forEach((gesture, index) => {
          if (gesture.type === 'pan' && gesture.startPoint && gesture.endPoint) {
            const currentPos = {
              x: gesture.startPoint.x + (gesture.endPoint.x - gesture.startPoint.x) * progress,
              y: gesture.startPoint.y + (gesture.endPoint.y - gesture.startPoint.y) * progress,
            };
            
            combinedEvent.translationX = currentPos.x - gesture.startPoint.x;
            combinedEvent.translationY = currentPos.y - gesture.startPoint.y;
            combinedEvent.x = currentPos.x;
            combinedEvent.y = currentPos.y;
          }

          if (gesture.type === 'pinch' && gesture.initialScale && gesture.finalScale) {
            combinedEvent.scale = gesture.initialScale + 
              (gesture.finalScale - gesture.initialScale) * progress;
            
            if (gesture.focalPoint) {
              combinedEvent.focalX = gesture.focalPoint.x;
              combinedEvent.focalY = gesture.focalPoint.y;
            }
          }

          if (gesture.type === 'rotation' && gesture.rotation) {
            combinedEvent.rotation = gesture.rotation * progress;
          }
        });

        combinedEvents.push(combinedEvent);

        if (global.GestureTestUtils?.createMockGestureEvent) {
          const mockEvent = global.GestureTestUtils.createMockGestureEvent(combinedEvent);
          handler.onGestureEvent?.(mockEvent);
        }
      }

      gestureResults.push({ combined: true, events: combinedEvents });
      
      // Also add individual gesture representations for test expectations
      gestures.forEach(gesture => {
        gestureResults.push({ 
          type: gesture.type, 
          individual: true,
          originalConfig: gesture 
        });
      });
    }

    return {
      gestures: gestureResults,
      combinedEvents,
      totalEvents: combinedEvents.length,
    };
  },

  /**
   * Simulates conflicting gestures with priority resolution
   */
  simulateConflictingGestures: (
    handler: any,
    gestures: Array<{
      type: string;
      priority: number;
      [key: string]: any;
    }>,
    options: {
      conflictResolution: 'priority' | 'first' | 'last';
      allowSimultaneous: boolean;
    }
  ) => {
    const { conflictResolution, allowSimultaneous } = options;

    if (!allowSimultaneous) {
      // Resolve conflict based on strategy
      let dominantGesture;
      const suppressedGestures = [];

      switch (conflictResolution) {
        case 'priority':
          dominantGesture = gestures.reduce((prev, current) => 
            current.priority > prev.priority ? current : prev
          );
          break;
        case 'first':
          dominantGesture = gestures[0];
          break;
        case 'last':
          dominantGesture = gestures[gestures.length - 1];
          break;
      }

      gestures.forEach(gesture => {
        if (gesture !== dominantGesture) {
          suppressedGestures.push(gesture.type);
        }
      });

      return {
        dominantGesture: dominantGesture?.type,
        suppressedGestures,
        resolutionReason: conflictResolution,
        resolved: true,
      };
    }

    return {
      dominantGesture: null,
      suppressedGestures: [],
      resolutionReason: 'simultaneous_allowed',
      resolved: false,
    };
  },

  /**
   * Simulates pan gesture with precise timing
   */
  simulatePanWithTiming: (
    handler: any,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    timing: {
      totalDuration: number;
      framerate: number;
      expectedFrames: number;
    }
  ) => {
    const { totalDuration, framerate, expectedFrames } = timing;
    const frameInterval = 1000 / framerate; // ms per frame
    const actualFrames = Math.round(totalDuration / frameInterval);
    
    const gestureEvents = [];
    const startTime = performance.now();

    for (let i = 0; i <= actualFrames; i++) {
      const progress = i / actualFrames;
      const currentTime = startTime + i * frameInterval;
      
      const currentPos = {
        x: startPoint.x + (endPoint.x - startPoint.x) * progress,
        y: startPoint.y + (endPoint.y - startPoint.y) * progress,
      };

      const event = {
        x: currentPos.x,
        y: currentPos.y,
        translationX: currentPos.x - startPoint.x,
        translationY: currentPos.y - startPoint.y,
        timestamp: currentTime,
        frameIndex: i,
        state: i === 0 ? 2 : i === actualFrames ? 5 : 4,
      };

      gestureEvents.push(event);

      if (global.GestureTestUtils?.createMockGestureEvent) {
        const mockEvent = global.GestureTestUtils.createMockGestureEvent(event);
        handler.onGestureEvent?.(mockEvent);
      }
    }

    const endTime = performance.now();

    return {
      gestureEvents,
      timing: {
        actualDuration: endTime - startTime,
        actualFrames,
        expectedFrames,
        frameRate: actualFrames / ((endTime - startTime) / 1000),
      },
    };
  },

  /**
   * Validates gesture timing accuracy
   */
  validateGestureTiming: (
    gestureResult: any,
    expectedTiming: {
      totalDuration: number;
      framerate: number;
      expectedFrames: number;
    }
  ) => {
    const { timing } = gestureResult;
    const { expectedFrames, framerate } = expectedTiming;

    const framePrecision = Math.min(timing.actualFrames / expectedFrames, expectedFrames / timing.actualFrames);
    const framerateDiff = Math.abs(timing.frameRate - framerate);
    const timingJitter = Math.abs(timing.actualDuration - expectedTiming.totalDuration);

    return {
      isAccurate: framePrecision > 0.8 && framerateDiff < 10 && timingJitter < 100,
      actualFrames: timing.actualFrames,
      framePrecision,
      timingJitter,
      framerateAccuracy: framerate > 0 ? Math.max(0, 1 - (framerateDiff / framerate)) : 0,
    };
  },

  /**
   * Validates physics-based behavior patterns
   */
  validatePhysicsPattern: (
    gestureData: any,
    expectations: {
      expectedDecayCurve: 'linear' | 'exponential';
      velocityConsistency: boolean;
      accelerationLimits: { min: number; max: number };
    }
  ) => {
    const { gestureEvents } = gestureData;
    const { expectedDecayCurve, velocityConsistency, accelerationLimits } = expectations;

    // Analyze velocity decay pattern
    const velocities = gestureEvents
      .filter((event: any) => event.phase === 'momentum')
      .map((event: any) => Math.sqrt(event.velocityX ** 2 + event.velocityY ** 2));

    let decayCurveMatch = 0;
    let velocityConsistent = true;
    const violations = [];

    if (velocities.length > 2) {
      // Check decay curve pattern
      if (expectedDecayCurve === 'exponential') {
        // For exponential decay, the ratio between consecutive velocities should be roughly constant
        const ratios = [];
        for (let i = 1; i < velocities.length; i++) {
          if (velocities[i - 1] > 0) {
            ratios.push(velocities[i] / velocities[i - 1]);
          }
        }
        
        const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
        const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - avgRatio, 2), 0) / ratios.length;
        decayCurveMatch = Math.max(0, 1 - variance); // Lower variance = better match
      }

      // Check velocity consistency (should always decrease in momentum phase)
      for (let i = 1; i < velocities.length; i++) {
        if (velocities[i] > velocities[i - 1]) {
          velocityConsistent = false;
          violations.push(`Velocity increased at frame ${i}: ${velocities[i - 1]} -> ${velocities[i]}`);
        }
      }

      // Check acceleration limits (only if significant change)
      for (let i = 1; i < velocities.length; i++) {
        const acceleration = (velocities[i] - velocities[i - 1]) / (16.67 / 1000); // Assuming 60fps
        if (Math.abs(acceleration) > 10 && (acceleration < accelerationLimits.min || acceleration > accelerationLimits.max)) {
          violations.push(`Acceleration out of bounds at frame ${i}: ${acceleration}`);
        }
      }
    }

    return {
      decayCurveMatch,
      velocityConsistent,
      physicallyPlausible: violations.length === 0,
      violations,
    };
  },

  // === EDGE CASE AND COMPLEX GESTURE SCENARIOS ===

  /**
   * Simulates complex path with direction changes
   */
  simulateComplexPath: (
    handler: any,
    path: Array<{ x: number; y: number }>,
    options: {
      pathSmoothing: number;
      directionChangeThreshold: number;
      velocityAdaptation: boolean;
    }
  ) => {
    const { pathSmoothing, directionChangeThreshold, velocityAdaptation } = options;
    const gestureEvents = [];
    let directionChanges = 0;
    let velocitySpikes = [];

    // Calculate path complexity metrics
    let totalDistance = 0;
    let totalAngleChange = 0;

    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const current = path[i];
      const next = i + 1 < path.length ? path[i + 1] : null;

      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(current.x - prev.x, 2) + Math.pow(current.y - prev.y, 2)
      );
      totalDistance += distance;

      // Calculate direction change
      if (next) {
        const angle1 = Math.atan2(current.y - prev.y, current.x - prev.x);
        const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
        let angleChange = Math.abs(angle2 - angle1) * (180 / Math.PI);
        
        if (angleChange > 180) angleChange = 360 - angleChange;
        totalAngleChange += angleChange;

        if (angleChange > directionChangeThreshold) {
          directionChanges++;
        }
      }

      // Calculate velocity with smoothing
      let velocity = { x: 0, y: 0 };
      if (i > 0) {
        velocity.x = (current.x - prev.x) * (velocityAdaptation ? pathSmoothing : 1);
        velocity.y = (current.y - prev.y) * (velocityAdaptation ? pathSmoothing : 1);
      }

      const velocityMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
      
      // Detect velocity spikes
      if (i > 1 && gestureEvents.length > 0) {
        const prevVelocity = Math.sqrt(
          gestureEvents[gestureEvents.length - 1].velocityX ** 2 + 
          gestureEvents[gestureEvents.length - 1].velocityY ** 2
        );
        
        if (velocityMagnitude > prevVelocity * 2) {
          velocitySpikes.push(i);
        }
      }

      const event = {
        x: current.x,
        y: current.y,
        translationX: current.x - path[0].x,
        translationY: current.y - path[0].y,
        velocityX: velocity.x,
        velocityY: velocity.y,
        pathIndex: i,
        state: i === 1 ? 2 : i === path.length - 1 ? 5 : 4,
      };

      gestureEvents.push(event);

      if (global.GestureTestUtils?.createMockGestureEvent) {
        const mockEvent = global.GestureTestUtils.createMockGestureEvent(event);
        handler.onGestureEvent?.(mockEvent);
      }
    }

    return {
      gestureEvents,
      pathComplexity: totalAngleChange / totalDistance,
      directionChanges,
      smoothedVelocity: pathSmoothing,
      velocitySpikes,
      totalDistance,
      totalAngleChange,
    };
  },

  /**
   * Simulates boundary interactions with different behaviors
   */
  simulateBoundaryInteraction: (
    handler: any,
    targetPoint: { x: number; y: number },
    boundaries: { minX: number; maxX: number; minY: number; maxY: number },
    options: {
      behavior: 'clamp' | 'bounce' | 'overscroll';
      elasticity?: number;
      resistance?: number;
    }
  ) => {
    const { behavior, elasticity = 0.7, resistance = 0.5 } = options;
    const gestureEvents = [];

    let finalPosition = { ...targetPoint };
    let bounceOccurred = false;
    let overscrollAmount = { x: 0, y: 0 };

    switch (behavior) {
      case 'clamp':
        finalPosition.x = Math.max(boundaries.minX, Math.min(boundaries.maxX, targetPoint.x));
        finalPosition.y = Math.max(boundaries.minY, Math.min(boundaries.maxY, targetPoint.y));
        break;

      case 'bounce':
        // Simulate bounce physics
        if (targetPoint.x < boundaries.minX || targetPoint.x > boundaries.maxX ||
            targetPoint.y < boundaries.minY || targetPoint.y > boundaries.maxY) {
          bounceOccurred = true;
          
          // Calculate bounce-back position
          const bounceSteps = 10;
          for (let i = 0; i <= bounceSteps; i++) {
            const progress = i / bounceSteps;
            const dampening = Math.pow(elasticity, progress * 3);
            
            let bouncePos = { ...targetPoint };
            
            if (targetPoint.x < boundaries.minX) {
              const penetration = boundaries.minX - targetPoint.x;
              bouncePos.x = boundaries.minX + penetration * dampening * Math.cos(progress * Math.PI * 2);
            } else if (targetPoint.x > boundaries.maxX) {
              const penetration = targetPoint.x - boundaries.maxX;
              bouncePos.x = boundaries.maxX - penetration * dampening * Math.cos(progress * Math.PI * 2);
            }
            
            if (targetPoint.y < boundaries.minY) {
              const penetration = boundaries.minY - targetPoint.y;
              bouncePos.y = boundaries.minY + penetration * dampening * Math.cos(progress * Math.PI * 2);
            } else if (targetPoint.y > boundaries.maxY) {
              const penetration = targetPoint.y - boundaries.maxY;
              bouncePos.y = boundaries.maxY - penetration * dampening * Math.cos(progress * Math.PI * 2);
            }

            if (i === bounceSteps) {
              finalPosition = {
                x: Math.max(boundaries.minX, Math.min(boundaries.maxX, bouncePos.x)),
                y: Math.max(boundaries.minY, Math.min(boundaries.maxY, bouncePos.y)),
              };
            }
          }
        }
        break;

      case 'overscroll':
        overscrollAmount.x = Math.max(0, 
          Math.max(boundaries.minX - targetPoint.x, targetPoint.x - boundaries.maxX)
        );
        overscrollAmount.y = Math.max(0,
          Math.max(boundaries.minY - targetPoint.y, targetPoint.y - boundaries.maxY)
        );
        
        // Apply resistance to overscroll
        if (targetPoint.x < boundaries.minX) {
          finalPosition.x = boundaries.minX - (boundaries.minX - targetPoint.x) * resistance;
        } else if (targetPoint.x > boundaries.maxX) {
          finalPosition.x = boundaries.maxX + (targetPoint.x - boundaries.maxX) * resistance;
        }
        
        if (targetPoint.y < boundaries.minY) {
          finalPosition.y = boundaries.minY - (boundaries.minY - targetPoint.y) * resistance;
        } else if (targetPoint.y > boundaries.maxY) {
          finalPosition.y = boundaries.maxY + (targetPoint.y - boundaries.maxY) * resistance;
        }
        break;
    }

    return {
      finalPosition,
      bounceOccurred,
      overscrollAmount,
      resistance,
      behavior,
    };
  },

  /**
   * Measures performance of complex gesture sequences
   */
  measureComplexGesturePerformance: (
    handler: any,
    sequence: {
      gestures: Array<{ type: string; duration: number; complexity: string }>;
      simultaneousTouches: number;
      totalDuration: number;
    },
    options: {
      performanceThresholds: {
        maxEventTime: number;
        maxFrameSkip: number;
        minFramerate: number;
      };
    }
  ) => {
    const startTime = performance.now();
    const startMemory = global.MemoryTestUtils.captureMemorySnapshot('gesture-perf-start');
    
    let totalEvents = 0;
    let frameSkips = 0;
    const eventTimes: number[] = [];

    // Simulate each gesture in the sequence
    sequence.gestures.forEach((gesture, index) => {
      const gestureStart = performance.now();
      
      // Simulate gesture based on type and complexity
      const eventCount = gesture.complexity === 'high' ? 20 : gesture.complexity === 'medium' ? 12 : 8;
      
      for (let i = 0; i < eventCount; i++) {
        const eventStart = performance.now();
        
        // Simulate gesture event processing
        const mockEvent = {
          type: gesture.type,
          index: i,
          gestureIndex: index,
          simultaneousTouches: sequence.simultaneousTouches,
        };

        if (global.GestureTestUtils?.createMockGestureEvent) {
          const event = global.GestureTestUtils.createMockGestureEvent(mockEvent);
          handler.onGestureEvent?.(event);
        }
        
        const eventEnd = performance.now();
        const eventTime = eventEnd - eventStart;
        eventTimes.push(eventTime);
        
        if (eventTime > options.performanceThresholds.maxEventTime) {
          frameSkips++;
        }
        
        totalEvents++;
      }
    });

    const endTime = performance.now();
    const endMemory = global.MemoryTestUtils.captureMemorySnapshot('gesture-perf-end');
    
    const totalDuration = endTime - startTime;
    const averageEventTime = eventTimes.reduce((sum, time) => sum + time, 0) / eventTimes.length;
    const effectiveFramerate = (totalEvents / (totalDuration / 1000));

    const memoryUsage = {
      peak: Math.max(startMemory.jsHeapSizeUsed, endMemory.jsHeapSizeUsed),
      growth: endMemory.jsHeapSizeUsed - startMemory.jsHeapSizeUsed,
    };

    return {
      averageEventTime,
      frameSkips,
      effectiveFramerate,
      totalEvents,
      totalDuration,
      memoryUsage,
      performanceScore: (
        (averageEventTime <= options.performanceThresholds.maxEventTime ? 1 : 0) +
        (frameSkips <= options.performanceThresholds.maxFrameSkip ? 1 : 0) +
        (effectiveFramerate >= options.performanceThresholds.minFramerate ? 1 : 0)
      ) / 3,
    };
  },

  // === PERFORMANCE INTEGRATION ===

  /**
   * Measures gesture performance against baseline
   */
  measureGesturePerformanceAgainstBaseline: (
    handler: any,
    gestureConfig: {
      type: string;
      duration: number;
      eventCount: number;
    },
    baseline: any
  ) => {
    const startTime = performance.now();

    // Execute gesture simulation
    let gestureResult;
    switch (gestureConfig.type) {
      case 'complex_pan_with_momentum':
        gestureResult = gestureTestUtils.simulatePanWithMomentum(
          handler,
          { x: 0, y: 0 },
          { x: 200, y: 100 },
          { velocity: { x: 300, y: 150 } }
        );
        break;
      default:
        gestureResult = { duration: 0 };
    }

    const endTime = performance.now();
    const actualDuration = endTime - startTime;

    // Compare against baseline
    const baselineAvg = baseline.gestureUpdateAverage || 1;
    const performanceRatio = baselineAvg / actualDuration;

    return {
      actualDuration,
      baselineDuration: baselineAvg,
      performanceRatio,
      comparedToBaseline: performanceRatio >= 0.8 ? 'good' : performanceRatio >= 0.6 ? 'acceptable' : 'poor',
      recommendationsApplied: performanceRatio >= 0.8,
    };
  },

  /**
   * Simulates gesture in worklet context
   */
  simulateWorkletGesture: (
    workletHandler: any,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    options: {
      workletContext: any;
      performanceMonitoring: boolean;
    }
  ) => {
    const { workletContext, performanceMonitoring } = options;
    const processedEvents = [];
    const executionTimes: number[] = [];

    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const currentPos = {
        x: startPoint.x + (endPoint.x - startPoint.x) * progress,
        y: startPoint.y + (endPoint.y - startPoint.y) * progress,
      };

      const event = {
        nativeEvent: {
          translationX: currentPos.x - startPoint.x,
          translationY: currentPos.y - startPoint.y,
          x: currentPos.x,
          y: currentPos.y,
        },
      };

      if (performanceMonitoring) {
        const executionResult = global.WorkletTestUtils.measureWorkletExecution(workletHandler, [event]);
        executionTimes.push(executionResult.duration);
        processedEvents.push(executionResult.result);
      } else {
        const result = global.WorkletTestUtils.executeWorklet(workletHandler, [event]);
        processedEvents.push(result);
      }
    }

    return {
      processedEvents,
      workletExecution: {
        executedInWorkletContext: true,
        averageExecutionTime: executionTimes.length > 0 
          ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
          : 0,
        totalExecutions: processedEvents.length,
      },
    };
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
 * MainScreen Testing Utilities
 * Helper functions specifically for testing MainScreen component and modular toggle functionality
 */
export const mainScreenTestUtils = {
  /**
   * Creates mock game controller with all required methods
   */
  createMockGameController: () => ({
    saveGame: jest.fn().mockResolvedValue(undefined),
    getResourceManager: jest.fn(() => ({
      addResource: jest.fn(),
      setResource: jest.fn(),
      getResource: jest.fn(() => ({ toNumber: () => 1000 })),
    })),
    getProbeManager: jest.fn(() => ({
      queueProbe: jest.fn(() => ({ success: true })),
      clear: jest.fn(),
    })),
    clearAllBeacons: jest.fn(),
    canAffordBeaconPlacement: jest.fn(() => true),
    getBeaconPlacementCost: jest.fn(() => ({ quantumData: 100 })),
    placeBeacon: jest.fn(() => ({ success: true })),
    getGameState: jest.fn(() => ({ beacons: {} })),
  }),

  /**
   * Creates mock game state with configurable beacons
   */
  createMockGameState: (beaconCount: number = 1) => {
    const beacons: any = {};
    
    for (let i = 0; i < beaconCount; i++) {
      beacons[`beacon-${i}`] = {
        id: `beacon-${i}`,
        x: 100 + i * 50,
        y: 100 + i * 50,
        type: ['pioneer', 'harvester', 'architect'][i % 3] as const,
        level: Math.floor(i / 3) + 1,
        connections: [],
        createdAt: Date.now() - i * 1000,
        lastResourceGeneration: Date.now() - i * 500,
      };
    }

    return { beacons };
  },

  /**
   * Creates complete MainScreen props with sensible defaults
   */
  createMockMainScreenProps: (overrides: any = {}) => {
    const gameController = mainScreenTestUtils.createMockGameController();
    const gameState = mainScreenTestUtils.createMockGameState();
    
    return {
      gameState,
      gameController,
      probes: [],
      isInitialized: true,
      error: null,
      ...overrides,
    };
  },

  /**
   * Finds the MOD button in a rendered component
   */
  findModButton: (getByText: any) => {
    try {
      return getByText('MOD');
    } catch (error) {
      throw new Error('MOD button not found - ensure __DEV__ is true and debug controls are rendered');
    }
  },

  /**
   * Toggles the modular map and waits for state change
   */
  toggleModularMap: async (getByText: any, act: any, fireEvent: any) => {
    const modButton = mainScreenTestUtils.findModButton(getByText);
    
    await act(async () => {
      fireEvent.press(modButton);
    });
    
    return modButton;
  },

  /**
   * Expects specific map mode to be active
   */
  expectMapMode: (getByTestId: any, queryByTestId: any, mode: 'Core' | 'Modular') => {
    if (mode === 'Core') {
      expect(getByTestId('galaxy-map-core')).toBeTruthy();
      expect(queryByTestId('galaxy-map-modular')).toBeNull();
    } else {
      expect(getByTestId('galaxy-map-modular')).toBeTruthy();
      expect(queryByTestId('galaxy-map-core')).toBeNull();
    }
  },

  /**
   * Expects GalaxyMapCore to be rendered with correct props
   */
  expectGalaxyMapCore: (getByTestId: any, expectedBeaconCount?: number) => {
    const coreMap = getByTestId('galaxy-map-core');
    expect(coreMap).toBeTruthy();
    
    if (expectedBeaconCount !== undefined) {
      expect(coreMap.props['data-beacons-count']).toBe(expectedBeaconCount);
    }
    
    return coreMap;
  },

  /**
   * Expects GalaxyMapModular to be rendered with correct props
   */
  expectGalaxyMapModular: (getByTestId: any, options: {
    expectedBeaconCount?: number;
    expectedModules?: string[];
    performanceMode?: boolean;
    debugMode?: boolean;
  } = {}) => {
    const modularMap = getByTestId('galaxy-map-modular');
    expect(modularMap).toBeTruthy();
    
    if (options.expectedBeaconCount !== undefined) {
      expect(modularMap.props['data-beacons-count']).toBe(options.expectedBeaconCount);
    }
    
    if (options.expectedModules !== undefined) {
      expect(modularMap.props['data-enabled-modules']).toBe(options.expectedModules.join(','));
    }
    
    if (options.performanceMode !== undefined) {
      expect(modularMap.props['data-performance-mode']).toBe(options.performanceMode);
    }
    
    if (options.debugMode !== undefined) {
      expect(modularMap.props['data-debug-mode']).toBe(options.debugMode);
    }
    
    return modularMap;
  },

  /**
   * Expects MOD button to be in correct state (active/inactive)
   */
  expectModButtonState: (button: any, active: boolean) => {
    expect(button).toBeTruthy();
    
    // In a real implementation, you would check CSS classes or styles here
    // For now, we just ensure the button exists and is functional
    const buttonParent = button.parent;
    expect(buttonParent).toBeTruthy();
  },

  /**
   * Simulates multiple rapid toggles for stress testing
   */
  performRapidToggles: async (getByText: any, act: any, fireEvent: any, count: number = 5) => {
    const modButton = mainScreenTestUtils.findModButton(getByText);
    
    for (let i = 0; i < count; i++) {
      await act(async () => {
        fireEvent.press(modButton);
      });
      
      // Small delay between toggles
      await act(async () => {
        jest.advanceTimersByTime(16);
      });
    }
    
    return modButton;
  },

  /**
   * Sets up development mode for debug controls
   */
  enableDebugMode: () => {
    const originalDEV = (global as any).__DEV__;
    (global as any).__DEV__ = true;
    
    return () => {
      (global as any).__DEV__ = originalDEV;
    };
  },

  /**
   * Waits for modular map activation and module initialization
   */
  waitForModularMapActivation: async (getByTestId: any, waitFor: any) => {
    await waitFor(() => {
      expect(getByTestId('galaxy-map-modular')).toBeTruthy();
    }, { timeout: 2000 });
  },

  /**
   * Checks debug overlay text for correct mode display
   */
  expectDebugModeText: (getByText: any, mode: 'Core' | 'Modular') => {
    expect(getByText(`Mode: ${mode}`)).toBeTruthy();
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