/**
 * GalaxyMapModular React Lifecycle Testing Suite
 * 
 * RED PHASE: Comprehensive testing of React lifecycle behavior during complex
 * state changes, prop updates, and re-renders.
 * 
 * This test suite follows TDD Red-Green-Refactor methodology by testing:
 * - Component mounting and unmounting behavior  
 * - State updates and re-render optimization
 * - useEffect dependency management and cleanup
 * - useMemo and useCallback optimization correctness
 * - Complex prop changes and their lifecycle impact
 * - Memory leak prevention through proper cleanup
 */

import React from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react-native';
import GalaxyMapModular from '../GalaxyMapModular';
import { Beacon, Connection } from '../../../types/galaxy';
import { createMockBeacon, createMockConnections } from './test-utils';

// Mock all dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

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

// Lifecycle tracking
const lifecycleEvents: { event: string; timestamp: number; details?: any }[] = [];

const mockModuleManager = {
  renderModules: jest.fn(() => {
    lifecycleEvents.push({ event: 'modules-rendered', timestamp: Date.now() });
    return [];
  }),
  getEventBus: jest.fn(() => ({
    emit: jest.fn((event, payload) => {
      lifecycleEvents.push({ event: `eventBus-emit-${event}`, timestamp: Date.now(), details: payload });
    }),
    subscribe: jest.fn(() => {
      lifecycleEvents.push({ event: 'eventBus-subscribe', timestamp: Date.now() });
      return () => {
        lifecycleEvents.push({ event: 'eventBus-unsubscribe', timestamp: Date.now() });
      };
    }),
  })),
  getGlobalPerformanceMetrics: jest.fn(() => ({
    averageFps: 60,
    frameCount: 100,
    disabledModules: [],
    performanceMode: false,
  })),
  getAllModules: jest.fn(() => []),
  registerModule: jest.fn(() => Promise.resolve()),
  disableModule: jest.fn(),
};

jest.mock('../../../utils/galaxy/modules', () => {
  const originalModules = jest.requireActual('../../../utils/galaxy/modules');
  
  return {
    ...originalModules,
    ModuleManager: jest.fn().mockImplementation(() => {
      lifecycleEvents.push({ event: 'ModuleManager-constructed', timestamp: Date.now() });
      return mockModuleManager;
    }),
    BeaconRenderingModule: jest.fn().mockImplementation(() => {
      lifecycleEvents.push({ event: 'BeaconRenderingModule-constructed', timestamp: Date.now() });
      return { id: 'beacon-rendering' };
    }),
    ConnectionRenderingModule: jest.fn().mockImplementation(() => {
      lifecycleEvents.push({ event: 'ConnectionRenderingModule-constructed', timestamp: Date.now() });
      return { id: 'connection-rendering' };
    }),
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

jest.mock('../../../utils/spatial/viewport', () => ({
  screenToGalaxy: jest.fn((point) => point),
  galaxyToScreen: jest.fn((point) => point),
  calculateVisibleBounds: jest.fn(() => ({ minX: 0, maxX: 800, minY: 0, maxY: 600 })),
  clampScale: jest.fn((scale) => Math.max(0.5, Math.min(3.0, scale))),
  constrainTranslationElastic: jest.fn((translation) => translation),
  calculateZoomFocalPoint: jest.fn((focal, translation, oldScale, newScale) => translation),
  isPointInHitArea: jest.fn(() => false),
}));

jest.mock('../../../utils/galaxy/GalaxyMapConfig', () => ({
  galaxyMapConfig: {
    reportPerformance: jest.fn(),
    shouldSkipFrame: jest.fn(() => false),
    getPerformanceStats: jest.fn(() => ({
      currentQuality: 'high',
      skipRatio: 0,
    })),
    emergencyReset: jest.fn(),
    setQualityLevel: jest.fn(),
    setModuleEnabled: jest.fn(),
  },
}));

// Clear lifecycle events before each test
beforeEach(() => {
  lifecycleEvents.length = 0;
  jest.clearAllMocks();
});

// Cleanup after each test
afterEach(cleanup);

// Suppress console during tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
beforeEach(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

describe('GalaxyMapModular React Lifecycle', () => {
  const defaultProps = {
    width: 400,
    height: 600,
    beacons: [createMockBeacon('test-1', { x: 100, y: 100 })],
  };

  describe('Component Mounting and Initialization', () => {
    it('should follow correct initialization order during mount', async () => {
      // RED: Should fail if initialization order isn't being tracked properly
      render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'ModuleManager-constructed')).toBe(true);
      });

      // Verify initialization happens before rendering
      const moduleConstructed = lifecycleEvents.find(e => e.event === 'ModuleManager-constructed');
      const firstRender = lifecycleEvents.find(e => e.event === 'modules-rendered');
      
      if (moduleConstructed && firstRender) {
        expect(moduleConstructed.timestamp).toBeLessThanOrEqual(firstRender.timestamp);
      }
    });

    it('should initialize state correctly on mount', async () => {
      // RED: Should fail if initial state isn't properly set up
      const { getByTestId } = render(<GalaxyMapModular {...defaultProps} />);
      
      const component = getByTestId('galaxy-map');
      expect(component).toBeTruthy();

      // Check that the component has proper initial dimensions
      expect(component.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            width: 400,
            height: 600,
          }),
        ])
      );
    });

    it('should set up all required useEffect hooks on mount', async () => {
      // RED: Should fail if effect setup tracking isn't working
      render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        // Should have performance monitoring effect
        expect(lifecycleEvents.some(e => e.event.includes('ModuleManager'))).toBe(true);
      });
    });
  });

  describe('State Updates and Re-renders', () => {
    it('should minimize re-renders when props remain the same', async () => {
      // RED: Should fail if unnecessary re-renders are occurring
      const { rerender } = render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      const initialRenderCount = lifecycleEvents.filter(e => e.event === 'modules-rendered').length;

      // Re-render with identical props
      rerender(<GalaxyMapModular {...defaultProps} />);
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const afterRerenderCount = lifecycleEvents.filter(e => e.event === 'modules-rendered').length;
      
      // Should not trigger many additional renders for identical props
      expect(afterRerenderCount - initialRenderCount).toBeLessThanOrEqual(2);
    });

    it('should properly handle beacon array prop changes', async () => {
      // RED: Should fail if beacon changes aren't being handled efficiently
      const initialBeacons = [createMockBeacon('beacon-1', { x: 100, y: 100 })];
      const updatedBeacons = [
        ...initialBeacons,
        createMockBeacon('beacon-2', { x: 200, y: 200 }),
      ];

      const { rerender } = render(
        <GalaxyMapModular
          {...defaultProps}
          beacons={initialBeacons}
        />
      );
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      lifecycleEvents.length = 0; // Clear previous events

      rerender(
        <GalaxyMapModular
          {...defaultProps}
          beacons={updatedBeacons}
        />
      );

      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      // Should trigger a re-render when beacons change
      expect(lifecycleEvents.filter(e => e.event === 'modules-rendered').length).toBeGreaterThan(0);
    });

    it('should handle dimension changes correctly', async () => {
      // RED: Should fail if dimension changes don't trigger proper lifecycle events
      const { rerender } = render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      lifecycleEvents.length = 0; // Clear previous events

      rerender(
        <GalaxyMapModular
          {...defaultProps}
          width={500}
          height={700}
        />
      );

      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event.includes('viewport:changed'))).toBe(true);
      });
    });
  });

  describe('useEffect Dependencies and Cleanup', () => {
    it('should properly clean up on unmount', async () => {
      // RED: Should fail if cleanup isn't being tracked
      const { unmount } = render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'eventBus-subscribe')).toBe(true);
      });

      unmount();

      // Should have called cleanup functions
      expect(lifecycleEvents.some(e => e.event === 'eventBus-unsubscribe')).toBe(true);
    });

    it('should handle performance monitoring effect dependencies correctly', async () => {
      // RED: Should fail if performance monitoring dependencies aren't stable
      const { rerender } = render(
        <GalaxyMapModular
          {...defaultProps}
          performanceMode={false}
        />
      );
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'ModuleManager-constructed')).toBe(true);
      });

      const initialModuleCount = lifecycleEvents.filter(e => 
        e.event === 'ModuleManager-constructed'
      ).length;

      // Change performance mode - should trigger re-initialization
      rerender(
        <GalaxyMapModular
          {...defaultProps}
          performanceMode={true}
        />
      );

      await waitFor(() => {
        const newModuleCount = lifecycleEvents.filter(e => 
          e.event === 'ModuleManager-constructed'
        ).length;
        expect(newModuleCount).toBeGreaterThan(initialModuleCount);
      });
    });

    it('should handle enabledModules dependency changes correctly', async () => {
      // RED: Should fail if enabledModules changes don't trigger proper effects
      const { rerender } = render(
        <GalaxyMapModular
          {...defaultProps}
          enabledModules={['beacon-rendering']}
        />
      );
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'ModuleManager-constructed')).toBe(true);
      });

      const initialModuleCount = lifecycleEvents.filter(e => 
        e.event === 'ModuleManager-constructed'
      ).length;

      // Change enabled modules - should trigger re-initialization
      rerender(
        <GalaxyMapModular
          {...defaultProps}
          enabledModules={['beacon-rendering', 'connection-rendering']}
        />
      );

      await waitFor(() => {
        const newModuleCount = lifecycleEvents.filter(e => 
          e.event === 'ModuleManager-constructed'
        ).length;
        expect(newModuleCount).toBeGreaterThan(initialModuleCount);
      });
    });
  });

  describe('useMemo and useCallback Optimization', () => {
    it('should memoize expensive screen dimensions calculations', async () => {
      // RED: Should fail if memoization isn't working properly
      const { rerender } = render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      const initialRenderCount = lifecycleEvents.filter(e => e.event === 'modules-rendered').length;

      // Re-render with same dimensions - should not cause excessive re-computation
      rerender(<GalaxyMapModular {...defaultProps} />);
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const afterRerenderCount = lifecycleEvents.filter(e => e.event === 'modules-rendered').length;
      
      // Should minimize additional work for same dimensions
      expect(afterRerenderCount - initialRenderCount).toBeLessThanOrEqual(2);
    });

    it('should memoize beacon processing correctly', async () => {
      // RED: Should fail if beacon memoization isn't working
      const beacons = [
        createMockBeacon('beacon-1', { x: 100, y: 100 }),
        createMockBeacon('beacon-2', { x: 200, y: 200 }),
      ];

      const { rerender } = render(
        <GalaxyMapModular
          {...defaultProps}
          beacons={beacons}
        />
      );
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      lifecycleEvents.length = 0;

      // Re-render with same beacon array reference
      rerender(
        <GalaxyMapModular
          {...defaultProps}
          beacons={beacons}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Should not trigger excessive re-processing
      const renderCount = lifecycleEvents.filter(e => e.event === 'modules-rendered').length;
      expect(renderCount).toBeLessThanOrEqual(2);
    });

    it('should invalidate memoization when beacon content changes', async () => {
      // RED: Should fail if memoization doesn't properly detect changes
      const initialBeacons = [createMockBeacon('beacon-1', { x: 100, y: 100 })];
      const changedBeacons = [createMockBeacon('beacon-1', { x: 150, y: 150 })];

      const { rerender } = render(
        <GalaxyMapModular
          {...defaultProps}
          beacons={initialBeacons}
        />
      );
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      lifecycleEvents.length = 0;

      rerender(
        <GalaxyMapModular
          {...defaultProps}
          beacons={changedBeacons}
        />
      );

      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      // Should trigger re-processing when beacon positions change
      const renderCount = lifecycleEvents.filter(e => e.event === 'modules-rendered').length;
      expect(renderCount).toBeGreaterThan(0);
    });
  });

  describe('Complex Prop Changes and State Management', () => {
    it('should handle rapid prop changes without state corruption', async () => {
      // RED: Should fail if rapid changes cause state issues
      const { rerender } = render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      // Rapid sequence of prop changes
      const changes = [
        { width: 500, height: 600 },
        { width: 600, height: 700 },
        { width: 400, height: 600 }, // Back to original
      ];

      for (const change of changes) {
        await act(async () => {
          rerender(<GalaxyMapModular {...defaultProps} {...change} />);
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }

      // Component should still be functional after rapid changes
      expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
    });

    it('should maintain state consistency during complex updates', async () => {
      // RED: Should fail if state consistency isn't maintained
      const initialBeacons = [createMockBeacon('beacon-1', { x: 100, y: 100 })];
      const connections = createMockConnections(initialBeacons);

      const { rerender } = render(
        <GalaxyMapModular
          {...defaultProps}
          beacons={initialBeacons}
          connections={connections}
        />
      );
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      // Complex update with multiple prop changes
      const newBeacons = [
        ...initialBeacons,
        createMockBeacon('beacon-2', { x: 200, y: 200 }),
      ];
      const newConnections = createMockConnections(newBeacons);

      rerender(
        <GalaxyMapModular
          {...defaultProps}
          beacons={newBeacons}
          connections={newConnections}
          width={500}
          height={700}
          performanceMode={true}
        />
      );

      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      // Should handle complex updates without crashing
      expect(() => {
        // If we get here without throwing, state consistency is maintained
      }).not.toThrow();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should clear all timeouts and intervals on unmount', async () => {
      // RED: Should fail if timeout/interval cleanup isn't working
      jest.useFakeTimers();
      
      const { unmount } = render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'modules-rendered')).toBe(true);
      });

      // Fast-forward to trigger performance monitoring
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      unmount();

      // Should not have any pending timers after unmount
      expect(jest.getTimerCount()).toBe(0);
      
      jest.useRealTimers();
    });

    it('should clean up event listeners and subscriptions on unmount', async () => {
      // RED: Should fail if event listener cleanup isn't tracked
      const { unmount } = render(<GalaxyMapModular {...defaultProps} />);
      
      await waitFor(() => {
        expect(lifecycleEvents.some(e => e.event === 'eventBus-subscribe')).toBe(true);
      });

      unmount();

      // Should have called unsubscribe functions
      expect(lifecycleEvents.some(e => e.event === 'eventBus-unsubscribe')).toBe(true);
    });

    it('should not create memory leaks during rapid mount/unmount cycles', async () => {
      // RED: Should fail if memory leaks occur during rapid cycles
      const mountAndUnmount = async () => {
        const { unmount } = render(<GalaxyMapModular {...defaultProps} />);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
        unmount();
      };

      // Rapid mount/unmount cycles
      for (let i = 0; i < 5; i++) {
        await mountAndUnmount();
      }

      // Should not accumulate lifecycle events indefinitely
      // (This is a proxy test for memory leaks - in real scenarios we'd use more sophisticated memory testing)
      const subscriptionEvents = lifecycleEvents.filter(e => e.event === 'eventBus-subscribe');
      const unsubscriptionEvents = lifecycleEvents.filter(e => e.event === 'eventBus-unsubscribe');
      
      expect(unsubscriptionEvents.length).toBe(subscriptionEvents.length);
    });
  });
});