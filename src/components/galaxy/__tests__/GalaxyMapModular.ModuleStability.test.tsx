/**
 * GalaxyMapModular Module Stability Test Suite
 * 
 * This test validates that modules remain stable and don't re-initialize
 * during normal operations like panning, prop updates, or state changes.
 * 
 * These tests are designed to catch the specific issues causing modules
 * to disappear and re-initialize during user interactions.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { GalaxyMapModular } from '../GalaxyMapModular';
import { Beacon, Connection } from '../../../types/galaxy';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock expo-battery
jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(1)),
  getBatteryStateAsync: jest.fn(() => Promise.resolve(1)),
  isLowPowerModeEnabledAsync: jest.fn(() => Promise.resolve(false)),
  PowerState: { CHARGING: 1, UNPLUGGED: 2, UNKNOWN: 0 },
}));

// Mock performance utilities
jest.mock('../../../utils/performance/BatteryOptimizationManager', () => ({
  BatteryOptimizationManager: {
    getInstance: jest.fn(() => ({
      getCurrentOptimizationLevel: jest.fn(() => 'normal'),
      shouldEnableEffect: jest.fn(() => true),
      getAnimationScale: jest.fn(() => 1),
    })),
  },
}));

jest.mock('../../../hooks/useBatteryOptimization', () => ({
  useBatteryAwareVisualEffects: jest.fn(() => ({
    enableGlowEffects: true,
    enableAnimations: true,
    animationScale: 1,
  })),
}));

// Mock module manager to track initialization calls
const moduleInitializationCalls: Array<{ timestamp: number; reason: string }> = [];
const mockModuleManager = {
  renderModules: jest.fn(() => ['mock-module-1', 'mock-module-2']),
  getEventBus: jest.fn(() => ({
    emit: jest.fn(),
    subscribe: jest.fn(() => () => {}),
  })),
  getGlobalPerformanceMetrics: jest.fn(() => ({
    averageFps: 60,
    frameCount: 100,
    disabledModules: [],
    performanceMode: false,
  })),
  getAllModules: jest.fn(() => []),
};

// Track ModuleManager constructor calls
jest.mock('../../../utils/galaxy/modules', () => {
  const originalModules = jest.requireActual('../../../utils/galaxy/modules');
  return {
    ...originalModules,
    ModuleManager: jest.fn().mockImplementation((...args) => {
      moduleInitializationCalls.push({
        timestamp: Date.now(),
        reason: 'ModuleManager constructor called',
      });
      return mockModuleManager;
    }),
    BeaconRenderingModule: jest.fn(),
    ConnectionRenderingModule: jest.fn(),
    EnvironmentRenderingModule: jest.fn(),
    StarSystemModule: jest.fn(),
    SectorModule: jest.fn(),
    GestureModule: jest.fn(),
    LODModule: jest.fn(),
    SpatialModule: jest.fn(),
    EntropyModule: jest.fn(),
    OverlayModule: jest.fn(),
  };
});

// Mock Reanimated and gesture handlers
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    Pan: () => ({ onStart: jest.fn().mockReturnThis(), onUpdate: jest.fn().mockReturnThis(), onEnd: jest.fn().mockReturnThis(), simultaneousWithExternalGesture: jest.fn().mockReturnThis() }),
    Pinch: () => ({ onStart: jest.fn().mockReturnThis(), onUpdate: jest.fn().mockReturnThis(), onEnd: jest.fn().mockReturnThis(), simultaneousWithExternalGesture: jest.fn().mockReturnThis() }),
    Tap: () => ({ onEnd: jest.fn().mockReturnThis(), requireExternalGestureToFail: jest.fn().mockReturnThis() }),
    Simultaneous: () => ({}),
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock SVG
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  G: 'G',
  Circle: 'Circle',
  Rect: 'Rect',
  Defs: 'Defs',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
}));

// Mock utilities
jest.mock('../../../utils/spatial/viewport', () => ({
  screenToGalaxy: jest.fn((point) => point),
  galaxyToScreen: jest.fn((point) => point),
  calculateVisibleBounds: jest.fn(() => ({ minX: 0, maxX: 800, minY: 0, maxY: 600 })),
  clampScale: jest.fn((scale) => Math.max(0.5, Math.min(3.0, scale))),
  constrainTranslationElastic: jest.fn((translation) => translation),
  calculateZoomFocalPoint: jest.fn((focal, translation) => translation),
  isPointInHitArea: jest.fn(() => false),
}));

jest.mock('../../../utils/galaxy/GalaxyMapConfig', () => ({
  galaxyMapConfig: {
    reportPerformance: jest.fn(),
    shouldSkipFrame: jest.fn(() => false),
    getPerformanceStats: jest.fn(() => ({ currentQuality: 'high', skipRatio: 0 })),
    emergencyReset: jest.fn(),
  },
}));

jest.mock('../../../utils/performance/WorkletDataIsolation', () => ({
  createWorkletSafeClone: jest.fn((obj) => ({ ...obj })),
  freezeForWorklet: jest.fn((obj) => obj),
}));

// Test data
const createMockBeacon = (id: string, x: number, y: number): Beacon => ({
  id,
  position: { x, y },
  level: 1,
  type: 'pioneer',
  connections: [],
});

const createMockConnection = (id: string, sourceId: string, targetId: string): Connection => ({
  id,
  sourceId,
  targetId,
  strength: 1,
  isActive: true,
  patterns: [],
});

const mockBeacons = [
  createMockBeacon('beacon1', 100, 100),
  createMockBeacon('beacon2', 200, 200),
];

const mockConnections = [
  createMockConnection('conn1', 'beacon1', 'beacon2'),
];

describe('GalaxyMapModular Module Stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    moduleInitializationCalls.length = 0;
  });

  describe('Module Initialization Stability', () => {
    it('should initialize modules only once during initial render', () => {
      render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      );

      // Should have called ModuleManager constructor exactly once
      expect(moduleInitializationCalls).toHaveLength(1);
    });

    it('should NOT re-initialize modules when viewport changes', () => {
      const { rerender } = render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      );

      // Clear initial initialization
      moduleInitializationCalls.length = 0;

      // Re-render with same props (this simulates viewport state changes)
      rerender(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      );

      // Should NOT have re-initialized modules
      expect(moduleInitializationCalls).toHaveLength(0);
    });

    it('should NOT re-initialize modules when beacons array changes but enabledModules stays same', () => {
      const initialBeacons = [createMockBeacon('beacon1', 100, 100)];
      const newBeacons = [...initialBeacons, createMockBeacon('beacon2', 200, 200)];

      const { rerender } = render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={initialBeacons}
          connections={[]}
        />
      );

      // Clear initial initialization
      moduleInitializationCalls.length = 0;

      // Re-render with new beacons
      rerender(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={newBeacons}
          connections={[]}
        />
      );

      // Should NOT have re-initialized modules (this is currently failing)
      expect(moduleInitializationCalls).toHaveLength(0);
    });

    it('should NOT re-initialize modules when enabledModules is empty array (default)', () => {
      const { rerender } = render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          enabledModules={[]} // Explicit empty array
        />
      );

      // Clear initial initialization
      moduleInitializationCalls.length = 0;

      // Re-render with new empty array (different reference but same content)
      rerender(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          enabledModules={[]} // New empty array reference
        />
      );

      // Should NOT have re-initialized modules (this is currently failing)
      expect(moduleInitializationCalls).toHaveLength(0);
    });

    it('should ONLY re-initialize modules when performanceMode actually changes', () => {
      const { rerender } = render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          performanceMode={false}
        />
      );

      // Clear initial initialization
      moduleInitializationCalls.length = 0;

      // Re-render with same performanceMode
      rerender(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          performanceMode={false} // Same value
        />
      );

      // Should NOT re-initialize
      expect(moduleInitializationCalls).toHaveLength(0);

      // Now change performanceMode
      rerender(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          performanceMode={true} // Different value
        />
      );

      // Should re-initialize (this is expected behavior)
      expect(moduleInitializationCalls).toHaveLength(1);
    });
  });

  describe('Module Rendering Stability', () => {
    it('should render modules consistently without flickering', () => {
      render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      );

      // Should call renderModules
      expect(mockModuleManager.renderModules).toHaveBeenCalled();
      
      // Get initial call count
      const initialCallCount = mockModuleManager.renderModules.mock.calls.length;

      // Simulate multiple renders (as would happen during panning)
      for (let i = 0; i < 5; i++) {
        // Force re-render by changing a prop that shouldn't affect modules
        render(
          <GalaxyMapModular
            width={800}
            height={600}
            beacons={mockBeacons}
            connections={mockConnections}
            key={i} // Force new component instance
          />
        );
      }

      // Should have called renderModules for each render
      expect(mockModuleManager.renderModules.mock.calls.length).toBeGreaterThan(initialCallCount);
      
      // But should NOT have re-initialized modules
      expect(moduleInitializationCalls.length).toBeLessThanOrEqual(5); // One per component instance
    });

    it('should maintain module context stability during prop changes', () => {
      const { rerender } = render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      );

      const initialRenderCount = mockModuleManager.renderModules.mock.calls.length;

      // Change props that should NOT cause excessive re-renders
      rerender(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
          style={{ backgroundColor: 'red' }} // Style change shouldn't affect modules
        />
      );

      // Should not have excessive re-renders
      const newRenderCount = mockModuleManager.renderModules.mock.calls.length;
      expect(newRenderCount - initialRenderCount).toBeLessThanOrEqual(2); // Allow some re-rendering, but not excessive
    });
  });

  describe('Array Reference Stability', () => {
    it('should handle empty array props without causing re-initialization', () => {
      // Test the specific issue with EMPTY_MODULES and other default arrays
      const emptyConnections1: Connection[] = [];
      const emptyConnections2: Connection[] = [];

      const { rerender } = render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={emptyConnections1}
        />
      );

      moduleInitializationCalls.length = 0;

      rerender(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={emptyConnections2} // Different array reference, same content
        />
      );

      // Should handle different array references gracefully
      expect(moduleInitializationCalls).toHaveLength(0);
    });

    it('should use stable references for default props', () => {
      // Render multiple times without explicit props
      const renders = [];
      for (let i = 0; i < 3; i++) {
        renders.push(
          render(
            <GalaxyMapModular
              width={800}
              height={600}
              beacons={mockBeacons}
              // No explicit connections, patterns, etc. - should use stable defaults
            />
          )
        );
      }

      // Should not have excessive re-initializations due to default prop references
      expect(moduleInitializationCalls.length).toBe(3); // One per render is acceptable
    });
  });

  describe('Performance Mode Detection', () => {
    it('should detect when frame skipping affects module rendering', () => {
      const { galaxyMapConfig } = require('../../../utils/galaxy/GalaxyMapConfig');
      
      // Mock frame skipping condition
      galaxyMapConfig.shouldSkipFrame.mockReturnValue(true);

      render(
        <GalaxyMapModular
          width={800}
          height={600}
          beacons={mockBeacons}
          connections={mockConnections}
        />
      );

      // Should have called shouldSkipFrame
      expect(galaxyMapConfig.shouldSkipFrame).toHaveBeenCalled();
    });
  });
});

// Helper to validate that modules are truly stable
export const validateModuleStability = (renderFunction: () => any, iterations = 10) => {
  const initializations = moduleInitializationCalls.length;
  
  for (let i = 0; i < iterations; i++) {
    renderFunction();
  }
  
  return {
    totalInitializations: moduleInitializationCalls.length - initializations,
    expectStable: () => {
      expect(moduleInitializationCalls.length - initializations).toBeLessThanOrEqual(iterations);
    },
  };
};